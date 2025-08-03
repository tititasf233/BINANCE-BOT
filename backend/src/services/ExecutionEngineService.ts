import { EventEmitter } from 'events';
import { messageBroker, BrokerMessage } from './MessageBrokerService';
import { apiKeyService } from './ApiKeyService';
import { tradeModel, TradeFields } from '@/database/models/Trade';
import { BinanceTradingService } from './BinanceTradingService';
import { SignalResult, StrategyParams } from '@/trading/strategies/BaseStrategy';
// Redis service import removed as it's not used
import { logger } from '@/utils/logger';

export interface TradeSignal {
  strategyId: number;
  userId: number;
  signal: SignalResult;
  strategyParams: StrategyParams;
}

export interface ExecutionResult {
  success: boolean;
  tradeId?: number;
  entryOrderId?: number;
  ocoOrderId?: number;
  error?: string;
  code?: string;
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageLatency: number;
  errorRate: number;
  openTrades: number;
}

export class ExecutionEngineService extends EventEmitter {
  private isInitialized = false;
  private executionCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private latencySum = 0;
  private latencyCount = 0;
  private activeLocks: Set<string> = new Set();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('trade_executed', (data: { tradeId: number; signal: SignalResult }) => {
      logger.info('Trade executed successfully', {
        tradeId: data.tradeId,
        signal: data.signal.signal
      });
    });

    this.on('execution_failed', (data: { error: string; signal: TradeSignal }) => {
      logger.error('Trade execution failed', {
        error: data.error,
        strategyId: data.signal.strategyId,
        symbol: data.signal.strategyParams.symbol
      });
      this.errorCount++;
    });

    this.on('error', (error) => {
      logger.error('ExecutionEngine error:', error);
    });
  }

  /**
   * Initialize the execution engine
   */
  async initialize(): Promise<void> {
    try {
      // Initialize message broker
      await messageBroker.initialize();

      // Subscribe to trading signals
      await messageBroker.subscribe('trading.signal.generated', this.handleTradeSignal.bind(this));

      // Start reconciliation process for orphaned trades
      this.startReconciliationProcess();

      this.isInitialized = true;
      logger.info('ExecutionEngine initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize ExecutionEngine:', error);
      throw error;
    }
  }

  /**
   * Handle incoming trade signals
   */
  private async handleTradeSignal(message: BrokerMessage): Promise<void> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const tradeSignal: TradeSignal = message.payload;
      
      logger.info('Processing trade signal', {
        strategyId: tradeSignal.strategyId,
        userId: tradeSignal.userId,
        signal: tradeSignal.signal.signal,
        symbol: tradeSignal.strategyParams.symbol
      });

      const result = await this.executeTradeSignal(tradeSignal);

      if (result.success) {
        this.successCount++;
        this.emit('trade_executed', {
          tradeId: result.tradeId,
          signal: tradeSignal.signal
        });
      } else {
        this.emit('execution_failed', {
          error: result.error || 'Unknown error',
          signal: tradeSignal
        });
      }

      // Update latency metrics
      const latency = Date.now() - startTime;
      this.latencySum += latency;
      this.latencyCount++;

    } catch (error) {
      logger.error('Error handling trade signal:', error);
      this.emit('error', error);
    }
  }

  /**
   * Execute a trade signal
   */
  private async executeTradeSignal(tradeSignal: TradeSignal): Promise<ExecutionResult> {
    const { strategyId, userId, signal, strategyParams } = tradeSignal;
    const lockKey = `execution:${strategyParams.symbol}:${userId}`;

    // Acquire lock to prevent concurrent executions for same symbol/user
    if (this.activeLocks.has(lockKey)) {
      return {
        success: false,
        error: 'Execution already in progress for this symbol',
        code: 'EXECUTION_LOCKED'
      };
    }

    this.activeLocks.add(lockKey);

    try {
      // Get user's API credentials
      const credentialsResult = await apiKeyService.getDecryptedCredentials(userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        return {
          success: false,
          error: 'No active API credentials found',
          code: 'NO_API_CREDENTIALS'
        };
      }

      const { apiKey, secretKey, isTestnet } = credentialsResult.credentials;
      const tradingService = new BinanceTradingService(apiKey, secretKey, isTestnet);

      // Handle different signal types
      if (signal.signal === 'BUY') {
        return await this.executeBuySignal(tradingService, strategyId, strategyParams, signal);
      } else if (signal.signal === 'SELL') {
        return await this.executeSellSignal(tradingService, strategyId, strategyParams, signal);
      } else {
        return {
          success: false,
          error: 'Invalid signal type',
          code: 'INVALID_SIGNAL'
        };
      }

    } catch (error) {
      logger.error('Error executing trade signal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXECUTION_ERROR'
      };
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }

  /**
   * Execute buy signal (entry or exit short)
   */
  private async executeBuySignal(
    tradingService: BinanceTradingService,
    strategyId: number,
    strategyParams: StrategyParams,
    signal: SignalResult
  ): Promise<ExecutionResult> {
    try {
      // Check if this is an exit signal for existing short position
      const openTrades = await tradeModel.findOpenTradesByStrategy(strategyId);
      const shortTrade = openTrades.find(trade => trade.side === 'SELL');

      if (shortTrade) {
        // Exit short position
        return await this.exitPosition(tradingService, shortTrade, signal);
      }

      // New long entry
      return await this.enterLongPosition(tradingService, strategyId, strategyParams, signal);

    } catch (error) {
      logger.error('Error executing buy signal:', error);
      throw error;
    }
  }

  /**
   * Execute sell signal (entry short or exit long)
   */
  private async executeSellSignal(
    tradingService: BinanceTradingService,
    strategyId: number,
    strategyParams: StrategyParams,
    signal: SignalResult
  ): Promise<ExecutionResult> {
    try {
      // Check if this is an exit signal for existing long position
      const openTrades = await tradeModel.findOpenTradesByStrategy(strategyId);
      const longTrade = openTrades.find(trade => trade.side === 'BUY');

      if (longTrade) {
        // Exit long position
        return await this.exitPosition(tradingService, longTrade, signal);
      }

      // For spot trading, we don't support short positions
      // In futures, this would create a short position
      return {
        success: false,
        error: 'Short positions not supported in spot trading',
        code: 'SHORT_NOT_SUPPORTED'
      };

    } catch (error) {
      logger.error('Error executing sell signal:', error);
      throw error;
    }
  }

  /**
   * Enter long position
   */
  private async enterLongPosition(
    tradingService: BinanceTradingService,
    strategyId: number,
    strategyParams: StrategyParams,
    signal: SignalResult
  ): Promise<ExecutionResult> {
    try {
      const { symbol, riskParams } = strategyParams;

      // Calculate quantity from USD amount
      const quantity = await tradingService.calculateQuantityFromUSD(
        symbol,
        riskParams.positionSizeUsd
      );

      // Validate order parameters
      const validation = await tradingService.validateOrderParams({
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: `Order validation failed: ${validation.errors.join(', ')}`,
          code: 'ORDER_VALIDATION_FAILED'
        };
      }

      // Place market buy order
      const entryOrder = await tradingService.placeMarketOrder({
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity
      });

      // Calculate average fill price
      const avgPrice = this.calculateAverageFillPrice(entryOrder.fills);
      const executedQty = parseFloat(entryOrder.executedQty);

      // Calculate OCO prices
      const takeProfitPrice = avgPrice * (1 + riskParams.takeProfitPercent / 100);
      const stopLossPrice = avgPrice * (1 - riskParams.stopLossPercent / 100);

      // Create trade record
      const trade = await tradeModel.create({
        strategy_id: strategyId,
        binance_order_id_entry: entryOrder.orderId,
        symbol,
        status: 'OPEN',
        side: 'BUY',
        entry_price: avgPrice,
        quantity: executedQty,
        entry_timestamp: new Date(entryOrder.transactTime),
        fees: this.calculateTotalFees(entryOrder.fills),
        take_profit_price: takeProfitPrice,
        stop_loss_price: stopLossPrice,
        metadata: {
          signal: signal,
          entryOrder: entryOrder
        }
      });

      // Place OCO order for risk management
      try {
        const ocoOrder = await tradingService.placeOCOOrder({
          symbol,
          side: 'SELL',
          quantity: executedQty.toString(),
          price: takeProfitPrice.toFixed(8),
          stopPrice: stopLossPrice.toFixed(8),
          stopLimitPrice: (stopLossPrice * 0.99).toFixed(8) // Slightly below stop price
        });

        // Update trade with OCO order ID
        await tradeModel.updateOCOOrderId(trade.id!, ocoOrder.orderListId);

        logger.info('Long position entered with OCO', {
          tradeId: trade.id,
          entryOrderId: entryOrder.orderId,
          ocoOrderId: ocoOrder.orderListId,
          entryPrice: avgPrice,
          quantity: executedQty
        });

        return {
          success: true,
          tradeId: trade.id!,
          entryOrderId: entryOrder.orderId,
          ocoOrderId: ocoOrder.orderListId
        };

      } catch (ocoError) {
        // If OCO fails, close the position immediately
        logger.error('Failed to place OCO order, closing position:', ocoError);
        
        try {
          await tradingService.placeMarketOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: executedQty.toString()
          });

          await tradeModel.markTradeAsFailed(trade.id!, 'OCO order failed');
        } catch (closeError) {
          logger.error('Failed to close position after OCO failure:', closeError);
        }

        return {
          success: false,
          error: 'Failed to place OCO order',
          code: 'OCO_FAILED'
        };
      }

    } catch (error) {
      logger.error('Error entering long position:', error);
      throw error;
    }
  }

  /**
   * Exit position
   */
  private async exitPosition(
    tradingService: BinanceTradingService,
    trade: TradeFields,
    signal: SignalResult
  ): Promise<ExecutionResult> {
    try {
      // Cancel existing OCO order if present
      if (trade.binance_order_id_oco) {
        try {
          await tradingService.cancelOCOOrder(trade.symbol, trade.binance_order_id_oco);
        } catch (cancelError) {
          logger.warn('Failed to cancel OCO order:', cancelError);
          // Continue with exit even if cancel fails
        }
      }

      // Place market order to close position
      const exitSide = trade.side === 'BUY' ? 'SELL' : 'BUY';
      logger.info(`Exiting position based on signal: ${signal.signal} with strength ${signal.strength}`);
      
      const exitOrder = await tradingService.placeMarketOrder({
        symbol: trade.symbol,
        side: exitSide,
        type: 'MARKET',
        quantity: trade.quantity.toString()
      });

      // Calculate average exit price
      const avgExitPrice = this.calculateAverageFillPrice(exitOrder.fills);
      const exitFees = this.calculateTotalFees(exitOrder.fills);

      // Close trade
      const closedTrade = await tradeModel.closeTrade(
        trade.id!,
        avgExitPrice,
        'CLOSED_MANUAL',
        exitFees
      );

      logger.info('Position closed', {
        tradeId: trade.id,
        exitOrderId: exitOrder.orderId,
        exitPrice: avgExitPrice,
        pnl: closedTrade?.pnl
      });

      return {
        success: true,
        tradeId: trade.id!,
        entryOrderId: exitOrder.orderId
      };

    } catch (error) {
      logger.error('Error exiting position:', error);
      throw error;
    }
  }

  /**
   * Calculate average fill price from order fills
   */
  private calculateAverageFillPrice(fills: Array<{ price: string; qty: string }>): number {
    let totalValue = 0;
    let totalQty = 0;

    for (const fill of fills) {
      const price = parseFloat(fill.price);
      const qty = parseFloat(fill.qty);
      totalValue += price * qty;
      totalQty += qty;
    }

    return totalQty > 0 ? totalValue / totalQty : 0;
  }

  /**
   * Calculate total fees from order fills
   */
  private calculateTotalFees(fills: Array<{ commission: string; commissionAsset: string }>): number {
    // Simplified fee calculation - in practice, you'd need to convert different assets to base currency
    return fills.reduce((total, fill) => {
      return total + parseFloat(fill.commission);
    }, 0);
  }

  /**
   * Start reconciliation process for orphaned trades
   */
  private startReconciliationProcess(): void {
    // Run reconciliation every 5 minutes
    setInterval(async () => {
      try {
        await this.reconcileOrphanedTrades();
      } catch (error) {
        logger.error('Error in reconciliation process:', error);
      }
    }, 5 * 60 * 1000);

    // Run initial reconciliation
    setTimeout(() => {
      this.reconcileOrphanedTrades().catch(error => {
        logger.error('Error in initial reconciliation:', error);
      });
    }, 10000); // Wait 10 seconds after startup
  }

  /**
   * Reconcile orphaned trades (trades without OCO orders)
   */
  private async reconcileOrphanedTrades(): Promise<void> {
    try {
      const orphanedTrades = await tradeModel.getOrphanedTrades();
      
      if (orphanedTrades.length === 0) {
        return;
      }

      logger.info('Found orphaned trades, attempting reconciliation', {
        count: orphanedTrades.length
      });

      for (const trade of orphanedTrades) {
        try {
          await this.reconcileOrphanedTrade(trade);
        } catch (error) {
          logger.error('Error reconciling orphaned trade:', {
            tradeId: trade.id,
            error
          });
        }
      }

    } catch (error) {
      logger.error('Error in orphaned trades reconciliation:', error);
    }
  }

  /**
   * Reconcile a single orphaned trade
   */
  private async reconcileOrphanedTrade(trade: TradeFields): Promise<void> {
    try {
      // This is a simplified reconciliation - in practice, you'd need to:
      // 1. Get the strategy's user ID and API credentials
      // 2. Check if the entry order is still valid
      // 3. Either create OCO order or close the position

      logger.warn('Orphaned trade found - manual intervention may be required', {
        tradeId: trade.id,
        symbol: trade.symbol,
        entryOrderId: trade.binance_order_id_entry
      });

      // For now, just mark as failed - in production, implement proper reconciliation
      await tradeModel.markTradeAsFailed(
        trade.id!,
        'Orphaned trade - missing OCO order'
      );

    } catch (error) {
      logger.error('Error reconciling orphaned trade:', error);
      throw error;
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): ExecutionStats {
    const averageLatency = this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0;
    const errorRate = this.executionCount > 0 ? (this.errorCount / this.executionCount) * 100 : 0;

    return {
      totalExecutions: this.executionCount,
      successfulExecutions: this.successCount,
      failedExecutions: this.errorCount,
      averageLatency,
      errorRate,
      openTrades: 0 // Would need to query database for current count
    };
  }

  /**
   * Get open trades count
   */
  async getOpenTradesCount(): Promise<number> {
    try {
      const openTrades = await tradeModel.findOpenTrades();
      return openTrades.length;
    } catch (error) {
      logger.error('Error getting open trades count:', error);
      return 0;
    }
  }

  /**
   * Force close all open trades (emergency function)
   */
  async forceCloseAllTrades(): Promise<{ success: boolean; closedTrades: number; errors: string[] }> {
    try {
      const openTrades = await tradeModel.findOpenTrades();
      const errors: string[] = [];
      const closedTrades = 0;

      for (const trade of openTrades) {
        try {
          // This would require getting user credentials and closing the trade
          // Implementation depends on your specific requirements
          logger.warn('Force close not implemented for trade', { tradeId: trade.id });
        } catch (error) {
          errors.push(`Failed to close trade ${trade.id}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        closedTrades,
        errors
      };

    } catch (error) {
      logger.error('Error force closing trades:', error);
      return {
        success: false,
        closedTrades: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      initialized: boolean;
      errorRate: number;
      averageLatency: number;
      activeLocks: number;
    };
  }> {
    const stats = this.getStats();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!this.isInitialized) {
      status = 'unhealthy';
    } else if (stats.errorRate > 20 || stats.averageLatency > 5000) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        initialized: this.isInitialized,
        errorRate: stats.errorRate,
        averageLatency: stats.averageLatency,
        activeLocks: this.activeLocks.size
      }
    };
  }

  /**
   * Shutdown the execution engine
   */
  async shutdown(): Promise<void> {
    try {
      // Unsubscribe from message broker
      await messageBroker.unsubscribe('trading.signal.generated');

      // Clear active locks
      this.activeLocks.clear();

      this.isInitialized = false;

      logger.info('ExecutionEngine shutdown completed');

    } catch (error) {
      logger.error('Error during ExecutionEngine shutdown:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const executionEngine = new ExecutionEngineService();
export default executionEngine;