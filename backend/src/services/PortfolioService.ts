import { tradeModel } from '@/database/models/Trade';
import { strategyModel } from '@/database/models/Strategy';
import { apiKeyService } from './ApiKeyService';
import { BinanceApiService } from './BinanceApiService';
import { redisService } from './RedisService';
import { logger } from '@/utils/logger';

export interface PortfolioOverview {
  totalValue: number;
  totalPnl: number;
  dailyPnl: number;
  totalFees: number;
  openPositions: number;
  activeStrategies: number;
  balances: AssetBalance[];
  performance: PerformanceMetrics;
}

export interface AssetBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
  percentage: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
}

export interface PositionSummary {
  id: number;
  strategyId: number;
  strategyName: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryTime: Date;
  duration: string;
}

export interface DailyPnLData {
  date: string;
  pnl: number;
  cumulativePnl: number;
  trades: number;
}

export class PortfolioService {
  private readonly CACHE_TTL = 60; // 1 minute cache

  /**
   * Get portfolio overview for user
   */
  async getPortfolioOverview(userId: number): Promise<{
    success: boolean;
    data?: PortfolioOverview;
    error?: string;
  }> {
    try {
      // Check cache first
      const cacheKey = `portfolio:overview:${userId}`;
      const cached = await redisService.get<PortfolioOverview>(cacheKey, true);
      
      if (cached) {
        return { success: true, data: cached };
      }

      // Get user's API credentials
      const credentialsResult = await apiKeyService.getDecryptedCredentials(userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        return {
          success: false,
          error: 'No active API credentials found'
        };
      }

      const { apiKey, secretKey, isTestnet } = credentialsResult.credentials;
      const binanceService = new BinanceApiService(apiKey, secretKey, isTestnet);

      // Get account balances
      const accountInfo = await binanceService.getAccountInfo();
      const balances = await this.processBalances(accountInfo.balances);

      // Get trading statistics
      const tradeStats = await tradeModel.getTradeStats();
      const userStrategies = await strategyModel.findByUserId(userId);
      const activeStrategies = userStrategies.filter(s => s.is_active).length;

      // Get daily PnL
      const today = new Date();
      const dailyPnl = await tradeModel.getDailyPnL(today);

      // Calculate total portfolio value
      const totalValue = balances.reduce((sum, balance) => sum + balance.usdValue, 0);

      // Get performance metrics
      const performance = await this.calculatePerformanceMetrics(userId);

      const overview: PortfolioOverview = {
        totalValue,
        totalPnl: tradeStats.totalPnl,
        dailyPnl,
        totalFees: tradeStats.totalFees,
        openPositions: tradeStats.openTrades,
        activeStrategies,
        balances,
        performance
      };

      // Cache the result
      await redisService.set(cacheKey, overview, this.CACHE_TTL);

      return { success: true, data: overview };

    } catch (error) {
      logger.error('Error getting portfolio overview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get open positions with current prices
   */
  async getOpenPositions(userId: number): Promise<{
    success: boolean;
    data?: PositionSummary[];
    error?: string;
  }> {
    try {
      // Get user's strategies
      const userStrategies = await strategyModel.findByUserId(userId);
      const strategyMap = new Map(userStrategies.map(s => [s.id!, s]));

      // Get open trades
      const openTrades = await tradeModel.findOpenTrades();
      const userOpenTrades = openTrades.filter(trade => 
        strategyMap.has(trade.strategy_id)
      );

      if (userOpenTrades.length === 0) {
        return { success: true, data: [] };
      }

      // Get current prices for all symbols
      const symbols = [...new Set(userOpenTrades.map(trade => trade.symbol))];
      const currentPrices = await this.getCurrentPrices(symbols, userId);

      // Build position summaries
      const positions: PositionSummary[] = userOpenTrades.map(trade => {
        const strategy = strategyMap.get(trade.strategy_id)!;
        const currentPrice = currentPrices[trade.symbol] || trade.entry_price;
        
        // Calculate unrealized PnL
        const unrealizedPnl = trade.side === 'BUY' 
          ? (currentPrice - trade.entry_price) * trade.quantity
          : (trade.entry_price - currentPrice) * trade.quantity;
        
        const unrealizedPnlPercent = (unrealizedPnl / (trade.entry_price * trade.quantity)) * 100;

        // Calculate duration
        const duration = this.formatDuration(Date.now() - trade.entry_timestamp.getTime());

        return {
          id: trade.id!,
          strategyId: trade.strategy_id,
          strategyName: strategy.name,
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entry_price,
          currentPrice,
          quantity: trade.quantity,
          unrealizedPnl,
          unrealizedPnlPercent,
          entryTime: trade.entry_timestamp,
          duration
        };
      });

      return { success: true, data: positions };

    } catch (error) {
      logger.error('Error getting open positions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get daily PnL history
   */
  async getDailyPnLHistory(
    userId: number, 
    days: number = 30
  ): Promise<{
    success: boolean;
    data?: DailyPnLData[];
    error?: string;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyData: DailyPnLData[] = [];
      let cumulativePnl = 0;

      // Get user's strategies to filter trades
      const userStrategies = await strategyModel.findByUserId(userId);
      const strategyIds = userStrategies.map(s => s.id!);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Get trades for this date
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        const dayTrades = await tradeModel.getTradesByDateRange(dayStart, dayEnd);
        const userDayTrades = dayTrades.filter(trade => 
          strategyIds.includes(trade.strategy_id)
        );

        const dayPnl = userDayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        cumulativePnl += dayPnl;

        dailyData.push({
          date: dateStr,
          pnl: dayPnl,
          cumulativePnl,
          trades: userDayTrades.length
        });
      }

      return { success: true, data: dailyData };

    } catch (error) {
      logger.error('Error getting daily PnL history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get portfolio allocation by strategy
   */
  async getStrategyAllocation(userId: number): Promise<{
    success: boolean;
    data?: Array<{
      strategyId: number;
      strategyName: string;
      symbol: string;
      totalPnl: number;
      totalTrades: number;
      winRate: number;
      allocation: number;
    }>;
    error?: string;
  }> {
    try {
      const userStrategies = await strategyModel.findByUserId(userId);
      const allocation = [];

      let totalPnl = 0;

      for (const strategy of userStrategies) {
        const stats = await tradeModel.getTradeStats(strategy.id!);
        totalPnl += stats.totalPnl;
      }

      for (const strategy of userStrategies) {
        const stats = await tradeModel.getTradeStats(strategy.id!);
        
        allocation.push({
          strategyId: strategy.id!,
          strategyName: strategy.name,
          symbol: strategy.symbol,
          totalPnl: stats.totalPnl,
          totalTrades: stats.totalTrades,
          winRate: stats.winRate,
          allocation: totalPnl !== 0 ? (stats.totalPnl / totalPnl) * 100 : 0
        });
      }

      return { success: true, data: allocation };

    } catch (error) {
      logger.error('Error getting strategy allocation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process account balances and calculate USD values
   */
  private async processBalances(
    binanceBalances: Array<{ asset: string; free: string; locked: string }>
  ): Promise<AssetBalance[]> {
    const balances: AssetBalance[] = [];
    let totalUsdValue = 0;

    // Get prices for all assets
    const assets = binanceBalances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => b.asset);

    const prices = await this.getAssetPrices(assets);

    for (const balance of binanceBalances) {
      const free = parseFloat(balance.free);
      const locked = parseFloat(balance.locked);
      const total = free + locked;

      if (total > 0) {
        const price = prices[balance.asset] || 0;
        const usdValue = total * price;
        totalUsdValue += usdValue;

        balances.push({
          asset: balance.asset,
          free,
          locked,
          total,
          usdValue,
          percentage: 0 // Will be calculated after total is known
        });
      }
    }

    // Calculate percentages
    balances.forEach(balance => {
      balance.percentage = totalUsdValue > 0 ? (balance.usdValue / totalUsdValue) * 100 : 0;
    });

    return balances.sort((a, b) => b.usdValue - a.usdValue);
  }

  /**
   * Get current prices for symbols
   */
  private async getCurrentPrices(
    symbols: string[], 
    userId: number
  ): Promise<Record<string, number>> {
    try {
      const credentialsResult = await apiKeyService.getDecryptedCredentials(userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        return {};
      }

      const { apiKey, secretKey, isTestnet } = credentialsResult.credentials;
      const binanceService = new BinanceApiService(apiKey, secretKey, isTestnet);

      const prices: Record<string, number> = {};

      for (const symbol of symbols) {
        try {
          const priceData = await binanceService.getSymbolPrice(symbol);
          prices[symbol] = parseFloat(priceData.price);
        } catch (error) {
          logger.warn(`Failed to get price for ${symbol}:`, error);
          prices[symbol] = 0;
        }
      }

      return prices;

    } catch (error) {
      logger.error('Error getting current prices:', error);
      return {};
    }
  }

  /**
   * Get asset prices in USD
   */
  private async getAssetPrices(assets: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    // USDT is always 1
    prices['USDT'] = 1;
    prices['BUSD'] = 1;
    prices['USDC'] = 1;

    // For other assets, we'd need to get their USDT prices
    // This is a simplified implementation
    for (const asset of assets) {
      if (!prices[asset]) {
        try {
          // Try to get price from a public API or set to 0
          prices[asset] = 0;
        } catch (error) {
          prices[asset] = 0;
        }
      }
    }

    return prices;
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(userId: number): Promise<PerformanceMetrics> {
    try {
      // Get user's strategies
      const userStrategies = await strategyModel.findByUserId(userId);
      const strategyIds = userStrategies.map(s => s.id!);

      // Get all trades for user's strategies
      const allTrades = await Promise.all(
        strategyIds.map(id => tradeModel.findByStrategyId(id))
      );
      const userTrades = allTrades.flat();

      if (userTrades.length === 0) {
        return {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          avgWin: 0,
          avgLoss: 0
        };
      }

      const closedTrades = userTrades.filter(t => t.status !== 'OPEN');
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
      const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);

      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

      const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

      const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

      // Calculate drawdown (simplified)
      let maxDrawdown = 0;
      let peak = 0;
      let runningPnl = 0;

      for (const trade of closedTrades.sort((a, b) => 
        a.entry_timestamp.getTime() - b.entry_timestamp.getTime()
      )) {
        runningPnl += trade.pnl || 0;
        peak = Math.max(peak, runningPnl);
        const drawdown = peak - runningPnl;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      // Simplified Sharpe ratio calculation
      const returns = closedTrades.map(t => (t.pnl || 0) / (t.entry_price * t.quantity));
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const returnStdDev = Math.sqrt(
        returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
      );
      const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

      return {
        totalTrades: closedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        profitFactor,
        sharpeRatio,
        maxDrawdown,
        avgWin,
        avgLoss
      };

    } catch (error) {
      logger.error('Error calculating performance metrics:', error);
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        avgWin: 0,
        avgLoss: 0
      };
    }
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Clear portfolio cache for user
   */
  async clearCache(userId: number): Promise<void> {
    try {
      const cacheKey = `portfolio:overview:${userId}`;
      await redisService.del(cacheKey);
    } catch (error) {
      logger.error('Error clearing portfolio cache:', error);
    }
  }

  /**
   * Get portfolio summary stats
   */
  async getPortfolioStats(userId: number): Promise<{
    success: boolean;
    stats?: {
      totalValue: number;
      totalPnl: number;
      dailyPnl: number;
      weeklyPnl: number;
      monthlyPnl: number;
      totalTrades: number;
      winRate: number;
      bestTrade: number;
      worstTrade: number;
    };
    error?: string;
  }> {
    try {
      // Get user's strategies
      const userStrategies = await strategyModel.findByUserId(userId);
      const strategyIds = userStrategies.map(s => s.id!);

      // Get all trades
      const allTrades = await Promise.all(
        strategyIds.map(id => tradeModel.findByStrategyId(id))
      );
      const userTrades = allTrades.flat().filter(t => t.status !== 'OPEN');

      // Calculate time-based PnL
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyTrades = userTrades.filter(t => t.exit_timestamp && t.exit_timestamp >= dayAgo);
      const weeklyTrades = userTrades.filter(t => t.exit_timestamp && t.exit_timestamp >= weekAgo);
      const monthlyTrades = userTrades.filter(t => t.exit_timestamp && t.exit_timestamp >= monthAgo);

      const dailyPnl = dailyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const weeklyPnl = weeklyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const monthlyPnl = monthlyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      const totalPnl = userTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winningTrades = userTrades.filter(t => (t.pnl || 0) > 0);
      const winRate = userTrades.length > 0 ? (winningTrades.length / userTrades.length) * 100 : 0;

      const tradePnls = userTrades.map(t => t.pnl || 0);
      const bestTrade = tradePnls.length > 0 ? Math.max(...tradePnls) : 0;
      const worstTrade = tradePnls.length > 0 ? Math.min(...tradePnls) : 0;

      // Get portfolio value (simplified - would need current balances)
      const totalValue = 10000; // Placeholder

      return {
        success: true,
        stats: {
          totalValue,
          totalPnl,
          dailyPnl,
          weeklyPnl,
          monthlyPnl,
          totalTrades: userTrades.length,
          winRate,
          bestTrade,
          worstTrade
        }
      };

    } catch (error) {
      logger.error('Error getting portfolio stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const portfolioService = new PortfolioService();