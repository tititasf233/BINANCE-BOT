import { BaseStrategy, StrategyParams, SignalResult } from '@/trading/strategies/BaseStrategy';
import { RSIStrategy } from '@/trading/strategies/RSIStrategy';
import { MACDStrategy } from '@/trading/strategies/MACDStrategy';
import { BinanceApiService } from './BinanceApiService';
import { KlineData } from './DataIngestorService';
import { logger } from '@/utils/logger';

export interface BacktestRequest {
  strategyType: 'RSI' | 'MACD' | 'CUSTOM';
  strategyParams: StrategyParams;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
}

export interface BacktestTrade {
  id: number;
  entryTime: number;
  exitTime?: number;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  pnl?: number;
  fees: number;
  entrySignal: SignalResult;
  exitSignal?: SignalResult;
}

export interface BacktestResult {
  success: boolean;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  totalFees: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ timestamp: number; balance: number; drawdown: number }>;
  monthlyReturns: Array<{ month: string; return: number }>;
  error?: string;
}

export class BacktestingService {
  private binanceApiService: BinanceApiService;

  constructor() {
    // Use public API for historical data (no auth required)
    this.binanceApiService = new BinanceApiService({
      apiKey: '',
      secretKey: '',
      isTestnet: false
    });
  }

  /**
   * Run backtest for a strategy
   */
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    try {
      logger.info('Starting backtest', {
        strategyType: request.strategyType,
        symbol: request.strategyParams.symbol,
        interval: request.strategyParams.interval,
        startDate: request.startDate,
        endDate: request.endDate
      });

      // Get historical data
      const historicalData = await this.getHistoricalData(
        request.strategyParams.symbol,
        request.strategyParams.interval,
        request.startDate,
        request.endDate
      );

      if (historicalData.length === 0) {
        return {
          success: false,
          error: 'No historical data available for the specified period',
          startDate: request.startDate,
          endDate: request.endDate,
          initialBalance: request.initialBalance,
          finalBalance: request.initialBalance,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnl: 0,
          totalFees: 0,
          maxDrawdown: 0,
          maxDrawdownPercent: 0,
          sharpeRatio: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          trades: [],
          equityCurve: [],
          monthlyReturns: []
        };
      }

      // Create strategy instance
      const strategy = this.createStrategyInstance(request.strategyType, request.strategyParams);

      // Run simulation
      const simulation = await this.runSimulation(
        strategy,
        historicalData,
        request.initialBalance,
        request.strategyParams.riskParams
      );

      // Calculate metrics
      const metrics = this.calculateMetrics(
        simulation.trades,
        simulation.equityCurve,
        request.initialBalance
      );

      logger.info('Backtest completed', {
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        totalPnl: metrics.totalPnl,
        finalBalance: simulation.finalBalance
      });

      return {
        success: true,
        startDate: request.startDate,
        endDate: request.endDate,
        initialBalance: request.initialBalance,
        finalBalance: simulation.finalBalance,
        trades: simulation.trades,
        equityCurve: simulation.equityCurve,
        monthlyReturns: this.calculateMonthlyReturns(simulation.equityCurve),
        ...metrics
      };

    } catch (error) {
      logger.error('Backtest failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate: request.startDate,
        endDate: request.endDate,
        initialBalance: request.initialBalance,
        finalBalance: request.initialBalance,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnl: 0,
        totalFees: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        trades: [],
        equityCurve: [],
        monthlyReturns: []
      };
    }
  }

  /**
   * Get historical kline data
   */
  private async getHistoricalData(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<KlineData[]> {
    try {
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      const limit = 1000; // Binance API limit
      const allKlines: KlineData[] = [];

      let currentStartTime = startTime;

      while (currentStartTime < endTime) {
        const rawKlines = await this.binanceApiService.getKlines(
          symbol,
          interval,
          limit,
          currentStartTime,
          Math.min(currentStartTime + (limit * this.getIntervalMs(interval)), endTime)
        );

        if (rawKlines.length === 0) {
          break;
        }

        const klines = rawKlines.map((kline: any[]) => ({
          symbol,
          interval,
          openTime: kline[0],
          closeTime: kline[6],
          open: kline[1],
          high: kline[2],
          low: kline[3],
          close: kline[4],
          volume: kline[5],
          trades: kline[8],
          isFinal: true
        }));

        allKlines.push(...klines);
        currentStartTime = klines[klines.length - 1].closeTime + 1;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return allKlines.filter(k => k.closeTime <= endTime);

    } catch (error) {
      logger.error('Error getting historical data:', error);
      throw error;
    }
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(interval: string): number {
    const intervalMap: Record<string, number> = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };

    return intervalMap[interval] || 60 * 60 * 1000; // Default to 1 hour
  }

  /**
   * Create strategy instance
   */
  private createStrategyInstance(type: string, params: StrategyParams): BaseStrategy {
    switch (type) {
      case 'RSI':
        return new RSIStrategy(params);
      case 'MACD':
        return new MACDStrategy(params);
      default:
        throw new Error(`Unsupported strategy type: ${type}`);
    }
  }

  /**
   * Run trading simulation
   */
  private async runSimulation(
    strategy: BaseStrategy,
    historicalData: KlineData[],
    initialBalance: number,
    riskParams: any
  ): Promise<{
    trades: BacktestTrade[];
    equityCurve: Array<{ timestamp: number; balance: number; drawdown: number }>;
    finalBalance: number;
  }> {
    const trades: BacktestTrade[] = [];
    const equityCurve: Array<{ timestamp: number; balance: number; drawdown: number }> = [];
    
    let currentBalance = initialBalance;
    let maxBalance = initialBalance;
    let tradeIdCounter = 1;
    let openTrade: BacktestTrade | null = null;

    // Setup strategy event handlers
    strategy.on('signal_generated', (signal: SignalResult) => {
      const currentKline = historicalData[historicalData.indexOf(
        historicalData.find(k => k.closeTime >= signal.timestamp) || historicalData[0]
      )];

      if (!currentKline) return;

      const currentPrice = parseFloat(currentKline.close);

      if (signal.signal === 'BUY' && !openTrade) {
        // Enter long position
        const positionSize = riskParams.positionSizeUsd;
        const quantity = positionSize / currentPrice;
        const fees = positionSize * 0.001; // 0.1% fee

        openTrade = {
          id: tradeIdCounter++,
          entryTime: currentKline.closeTime,
          entryPrice: currentPrice,
          quantity,
          side: 'BUY',
          status: 'OPEN',
          fees,
          entrySignal: signal
        };

        currentBalance -= fees;
        strategy.updatePosition('LONG', currentPrice);

      } else if (signal.signal === 'SELL' && openTrade) {
        // Exit long position
        const exitPrice = currentPrice;
        const exitFees = openTrade.quantity * exitPrice * 0.001; // 0.1% fee
        const pnl = (exitPrice - openTrade.entryPrice) * openTrade.quantity - exitFees;

        openTrade.exitTime = currentKline.closeTime;
        openTrade.exitPrice = exitPrice;
        openTrade.pnl = pnl;
        openTrade.fees += exitFees;
        openTrade.status = 'CLOSED_MANUAL';
        openTrade.exitSignal = signal;

        currentBalance += pnl;
        trades.push(openTrade);
        openTrade = null;

        strategy.updatePosition('NONE');
      }
    });

    // Process historical data
    for (let i = 0; i < historicalData.length; i++) {
      const kline = historicalData[i];
      
      // Process kline through strategy
      await strategy.onKline(kline);

      // Check for stop loss / take profit if position is open
      if (openTrade) {
        const currentPrice = parseFloat(kline.close);
        const entryPrice = openTrade.entryPrice;
        
        const takeProfitPrice = entryPrice * (1 + riskParams.takeProfitPercent / 100);
        const stopLossPrice = entryPrice * (1 - riskParams.stopLossPercent / 100);

        let shouldClose = false;
        let closeStatus: 'CLOSED_TP' | 'CLOSED_SL' = 'CLOSED_MANUAL';

        // Check if high reached take profit
        if (parseFloat(kline.high) >= takeProfitPrice) {
          shouldClose = true;
          closeStatus = 'CLOSED_TP';
          openTrade.exitPrice = takeProfitPrice;
        }
        // Check if low hit stop loss
        else if (parseFloat(kline.low) <= stopLossPrice) {
          shouldClose = true;
          closeStatus = 'CLOSED_SL';
          openTrade.exitPrice = stopLossPrice;
        }

        if (shouldClose) {
          const exitFees = openTrade.quantity * openTrade.exitPrice! * 0.001;
          const pnl = (openTrade.exitPrice! - openTrade.entryPrice) * openTrade.quantity - exitFees;

          openTrade.exitTime = kline.closeTime;
          openTrade.pnl = pnl;
          openTrade.fees += exitFees;
          openTrade.status = closeStatus;

          currentBalance += pnl;
          trades.push(openTrade);
          openTrade = null;

          strategy.updatePosition('NONE');
        }
      }

      // Update equity curve
      maxBalance = Math.max(maxBalance, currentBalance);
      const drawdown = maxBalance - currentBalance;
      
      equityCurve.push({
        timestamp: kline.closeTime,
        balance: currentBalance,
        drawdown
      });
    }

    // Close any remaining open trade at the end
    if (openTrade) {
      const lastKline = historicalData[historicalData.length - 1];
      const exitPrice = parseFloat(lastKline.close);
      const exitFees = openTrade.quantity * exitPrice * 0.001;
      const pnl = (exitPrice - openTrade.entryPrice) * openTrade.quantity - exitFees;

      openTrade.exitTime = lastKline.closeTime;
      openTrade.exitPrice = exitPrice;
      openTrade.pnl = pnl;
      openTrade.fees += exitFees;
      openTrade.status = 'CLOSED_MANUAL';

      currentBalance += pnl;
      trades.push(openTrade);
    }

    return {
      trades,
      equityCurve,
      finalBalance: currentBalance
    };
  }

  /**
   * Calculate backtest metrics
   */
  private calculateMetrics(
    trades: BacktestTrade[],
    equityCurve: Array<{ timestamp: number; balance: number; drawdown: number }>,
    initialBalance: number
  ): {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    totalFees: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  } {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0).length;
    
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
    
    const maxDrawdown = Math.max(...equityCurve.map(e => e.drawdown));
    const maxDrawdownPercent = maxDrawdown / initialBalance * 100;
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const wins = trades.filter(t => (t.pnl || 0) > 0).map(t => t.pnl || 0);
    const losses = trades.filter(t => (t.pnl || 0) < 0).map(t => Math.abs(t.pnl || 0));
    
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = losses.reduce((a, b) => a + b, 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Calculate Sharpe ratio (simplified)
    const returns = equityCurve.map((point, index) => {
      if (index === 0) return 0;
      return (point.balance - equityCurve[index - 1].balance) / equityCurve[index - 1].balance;
    }).slice(1);
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStdDev = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    );
    
    const sharpeRatio = returnStdDev > 0 ? (avgReturn / returnStdDev) * Math.sqrt(252) : 0; // Annualized

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl,
      totalFees,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      winRate,
      avgWin,
      avgLoss,
      profitFactor
    };
  }

  /**
   * Calculate monthly returns
   */
  private calculateMonthlyReturns(
    equityCurve: Array<{ timestamp: number; balance: number; drawdown: number }>
  ): Array<{ month: string; return: number }> {
    const monthlyReturns: Array<{ month: string; return: number }> = [];
    const monthlyData: Record<string, { start: number; end: number }> = {};

    for (const point of equityCurve) {
      const date = new Date(point.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { start: point.balance, end: point.balance };
      } else {
        monthlyData[monthKey].end = point.balance;
      }
    }

    for (const [month, data] of Object.entries(monthlyData)) {
      const monthReturn = data.start > 0 ? ((data.end - data.start) / data.start) * 100 : 0;
      monthlyReturns.push({ month, return: monthReturn });
    }

    return monthlyReturns.sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Validate backtest request
   */
  validateBacktestRequest(request: BacktestRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.strategyType) {
      errors.push('Strategy type is required');
    }

    if (!request.strategyParams) {
      errors.push('Strategy parameters are required');
    }

    if (!request.startDate || !request.endDate) {
      errors.push('Start date and end date are required');
    } else if (request.startDate >= request.endDate) {
      errors.push('Start date must be before end date');
    } else if (request.endDate > new Date()) {
      errors.push('End date cannot be in the future');
    }

    if (!request.initialBalance || request.initialBalance <= 0) {
      errors.push('Initial balance must be greater than 0');
    }

    // Check date range (max 1 year for performance)
    if (request.startDate && request.endDate) {
      const daysDiff = (request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        errors.push('Date range cannot exceed 1 year');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const backtestingService = new BacktestingService();