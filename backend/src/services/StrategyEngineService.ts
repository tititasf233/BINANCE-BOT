import { EventEmitter } from 'events';
import { strategyModel, StrategyFields } from '@/database/models/Strategy';
import { messageBroker, BrokerMessage } from './MessageBrokerService';
import { BaseStrategy, SignalResult } from '@/trading/strategies/BaseStrategy';
import { RSIStrategy } from '@/trading/strategies/RSIStrategy';
import { MACDStrategy } from '@/trading/strategies/MACDStrategy';
import { KlineData } from './DataIngestorService';
import { redisService } from './RedisService';
import { logger } from '@/utils/logger';

export interface StrategyInstance {
  id: number;
  userId: number;
  strategy: BaseStrategy;
  lastSignal?: SignalResult;
  lastUpdate: number;
  isRunning: boolean;
}

export interface StrategyEngineStats {
  totalStrategies: number;
  runningStrategies: number;
  totalSignals: number;
  signalsToday: number;
  averageLatency: number;
  errorRate: number;
}

export class StrategyEngineService extends EventEmitter {
  private strategies: Map<number, StrategyInstance> = new Map();
  private strategyTypes: Map<string, typeof BaseStrategy> = new Map();
  private isInitialized = false;
  private signalCount = 0;
  private errorCount = 0;
  private latencySum = 0;
  private latencyCount = 0;

  constructor() {
    super();
    this.registerStrategyTypes();
    this.setupEventHandlers();
  }

  private registerStrategyTypes(): void {
    this.strategyTypes.set('RSI', RSIStrategy as any);
    this.strategyTypes.set('MACD', MACDStrategy as any);
    // Add more strategy types as they are implemented
  }

  private setupEventHandlers(): void {
    this.on('signal_generated', async (data: { strategyId: number; signal: SignalResult }) => {
      await this.handleSignalGenerated(data.strategyId, data.signal);
    });

    this.on('strategy_error', (data: { strategyId: number; error: Error }) => {
      logger.error('Strategy error:', {
        strategyId: data.strategyId,
        error: data.error.message
      });
      this.errorCount++;
    });

    this.on('error', (error) => {
      logger.error('StrategyEngine error:', error);
    });
  }

  /**
   * Initialize the strategy engine
   */
  async initialize(): Promise<void> {
    try {
      // Initialize message broker
      await messageBroker.initialize();

      // Subscribe to market data events
      await messageBroker.subscribe('market.kline.closed', this.handleKlineData.bind(this));

      // Load and start active strategies
      await this.loadActiveStrategies();

      this.isInitialized = true;
      logger.info('StrategyEngine initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize StrategyEngine:', error);
      throw error;
    }
  }

  /**
   * Load all active strategies from database
   */
  private async loadActiveStrategies(): Promise<void> {
    try {
      const activeStrategies = await strategyModel.findAllActive();
      
      for (const strategyData of activeStrategies) {
        await this.startStrategy(strategyData);
      }

      logger.info('Loaded active strategies', { count: activeStrategies.length });

    } catch (error) {
      logger.error('Error loading active strategies:', error);
      throw error;
    }
  }

  /**
   * Start a strategy instance
   */
  async startStrategy(strategyData: StrategyFields): Promise<void> {
    try {
      if (this.strategies.has(strategyData.id!)) {
        logger.warn('Strategy already running', { strategyId: strategyData.id });
        return;
      }

      // Determine strategy type based on indicators or name
      const strategyType = this.determineStrategyType(strategyData);
      const StrategyClass = this.strategyTypes.get(strategyType);

      if (!StrategyClass) {
        throw new Error(`Unknown strategy type: ${strategyType}`);
      }

      // Convert database record to strategy params
      const params = strategyModel.toStrategyParams(strategyData);

      // Create strategy instance
      const strategy = new StrategyClass(params);

      // Setup strategy event handlers
      strategy.on('signal_generated', (signal: SignalResult) => {
        this.emit('signal_generated', { strategyId: strategyData.id!, signal });
      });

      strategy.on('error', (error: Error) => {
        this.emit('strategy_error', { strategyId: strategyData.id!, error });
      });

      // Activate strategy
      strategy.activate();

      // Store strategy instance
      const instance: StrategyInstance = {
        id: strategyData.id!,
        userId: strategyData.user_id,
        strategy,
        lastUpdate: Date.now(),
        isRunning: true
      };

      this.strategies.set(strategyData.id!, instance);

      // Cache strategy state
      await this.cacheStrategyState(instance);

      logger.info('Strategy started', {
        strategyId: strategyData.id,
        userId: strategyData.user_id,
        symbol: strategyData.symbol,
        type: strategyType
      });

    } catch (error) {
      logger.error('Error starting strategy:', { strategyId: strategyData.id, error });
      throw error;
    }
  }

  /**
   * Stop a strategy instance
   */
  async stopStrategy(strategyId: number): Promise<void> {
    try {
      const instance = this.strategies.get(strategyId);
      if (!instance) {
        logger.warn('Strategy not found for stopping', { strategyId });
        return;
      }

      // Deactivate strategy
      instance.strategy.deactivate();
      instance.isRunning = false;

      // Remove from active strategies
      this.strategies.delete(strategyId);

      // Remove cached state
      await redisService.del(`strategy:${strategyId}:state`);

      logger.info('Strategy stopped', { strategyId });

    } catch (error) {
      logger.error('Error stopping strategy:', { strategyId, error });
      throw error;
    }
  }

  /**
   * Handle incoming kline data
   */
  private async handleKlineData(message: BrokerMessage): Promise<void> {
    try {
      const klineData: KlineData = message.payload;
      const startTime = Date.now();

      // Find strategies that should process this kline
      const relevantStrategies = Array.from(this.strategies.values()).filter(instance => {
        const params = instance.strategy.getParams();
        return params.symbol === klineData.symbol && params.interval === klineData.interval;
      });

      // Process kline for each relevant strategy
      const promises = relevantStrategies.map(async (instance) => {
        try {
          await instance.strategy.onKline(klineData);
          instance.lastUpdate = Date.now();
          
          // Update cached state
          await this.cacheStrategyState(instance);

        } catch (error) {
          logger.error('Error processing kline in strategy:', {
            strategyId: instance.id,
            symbol: klineData.symbol,
            error
          });
          this.emit('strategy_error', { strategyId: instance.id, error: error as Error });
        }
      });

      await Promise.all(promises);

      // Update latency metrics
      const latency = Date.now() - startTime;
      this.latencySum += latency;
      this.latencyCount++;

      logger.debug('Processed kline data', {
        symbol: klineData.symbol,
        interval: klineData.interval,
        strategiesProcessed: relevantStrategies.length,
        latency
      });

    } catch (error) {
      logger.error('Error handling kline data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle generated trading signals
   */
  private async handleSignalGenerated(strategyId: number, signal: SignalResult): Promise<void> {
    try {
      const instance = this.strategies.get(strategyId);
      if (!instance) {
        logger.warn('Strategy not found for signal', { strategyId });
        return;
      }

      // Store last signal
      instance.lastSignal = signal;
      this.signalCount++;

      // Publish signal to execution engine
      await messageBroker.publish('trading.signal.generated', {
        strategyId,
        userId: instance.userId,
        signal,
        strategyParams: instance.strategy.getParams()
      }, 'StrategyEngine');

      // Cache updated state
      await this.cacheStrategyState(instance);

      logger.info('Trading signal generated', {
        strategyId,
        userId: instance.userId,
        signal: signal.signal,
        strength: signal.strength,
        symbol: instance.strategy.getParams().symbol
      });

    } catch (error) {
      logger.error('Error handling generated signal:', { strategyId, error });
      this.emit('error', error);
    }
  }

  /**
   * Determine strategy type from strategy data
   */
  private determineStrategyType(strategyData: StrategyFields): string {
    // Check if strategy name contains type hint
    const name = strategyData.name.toUpperCase();
    if (name.includes('RSI')) return 'RSI';
    if (name.includes('MACD')) return 'MACD';

    // Check indicator parameters
    const riskParams = strategyData.risk_params;
    if (riskParams.indicatorParams) {
      if (riskParams.indicatorParams.rsi) return 'RSI';
      if (riskParams.indicatorParams.macd) return 'MACD';
    }

    // Default to RSI if can't determine
    logger.warn('Could not determine strategy type, defaulting to RSI', {
      strategyId: strategyData.id,
      name: strategyData.name
    });
    return 'RSI';
  }

  /**
   * Cache strategy state in Redis
   */
  private async cacheStrategyState(instance: StrategyInstance): Promise<void> {
    try {
      const state = {
        id: instance.id,
        userId: instance.userId,
        isRunning: instance.isRunning,
        lastUpdate: instance.lastUpdate,
        lastSignal: instance.lastSignal,
        strategyState: instance.strategy.getState(),
        params: instance.strategy.getParams()
      };

      await redisService.set(
        `strategy:${instance.id}:state`,
        state,
        3600 // 1 hour expiry
      );

    } catch (error) {
      logger.error('Error caching strategy state:', { strategyId: instance.id, error });
    }
  }

  /**
   * Get strategy instance by ID
   */
  getStrategy(strategyId: number): StrategyInstance | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Get all running strategies
   */
  getRunningStrategies(): StrategyInstance[] {
    return Array.from(this.strategies.values()).filter(instance => instance.isRunning);
  }

  /**
   * Get strategies for a specific user
   */
  getUserStrategies(userId: number): StrategyInstance[] {
    return Array.from(this.strategies.values()).filter(instance => instance.userId === userId);
  }

  /**
   * Get strategies for a specific symbol
   */
  getStrategiesBySymbol(symbol: string): StrategyInstance[] {
    return Array.from(this.strategies.values()).filter(instance => {
      return instance.strategy.getParams().symbol === symbol;
    });
  }

  /**
   * Restart a strategy (stop and start)
   */
  async restartStrategy(strategyId: number): Promise<void> {
    try {
      const instance = this.strategies.get(strategyId);
      if (!instance) {
        throw new Error('Strategy not found');
      }

      // Get strategy data from database
      const strategyData = await strategyModel.findById(strategyId);
      if (!strategyData) {
        throw new Error('Strategy data not found in database');
      }

      // Stop current instance
      await this.stopStrategy(strategyId);

      // Start new instance
      await this.startStrategy(strategyData);

      logger.info('Strategy restarted', { strategyId });

    } catch (error) {
      logger.error('Error restarting strategy:', { strategyId, error });
      throw error;
    }
  }

  /**
   * Get engine statistics
   */
  getStats(): StrategyEngineStats {
    const runningStrategies = this.getRunningStrategies();
    const averageLatency = this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0;
    const errorRate = this.signalCount > 0 ? (this.errorCount / this.signalCount) * 100 : 0;

    return {
      totalStrategies: this.strategies.size,
      runningStrategies: runningStrategies.length,
      totalSignals: this.signalCount,
      signalsToday: this.signalCount, // Simplified - would need date tracking
      averageLatency,
      errorRate
    };
  }

  /**
   * Get detailed strategy status
   */
  async getStrategyStatus(strategyId: number): Promise<{
    instance: StrategyInstance | null;
    cachedState: any;
    dbRecord: StrategyFields | null;
  }> {
    const instance = this.getStrategy(strategyId);
    const cachedState = await redisService.get(`strategy:${strategyId}:state`, true);
    const dbRecord = await strategyModel.findById(strategyId);

    return {
      instance,
      cachedState,
      dbRecord
    };
  }

  /**
   * Shutdown the strategy engine
   */
  async shutdown(): Promise<void> {
    try {
      // Stop all running strategies
      const runningStrategies = Array.from(this.strategies.keys());
      for (const strategyId of runningStrategies) {
        await this.stopStrategy(strategyId);
      }

      // Unsubscribe from message broker
      await messageBroker.unsubscribe('market.kline.closed');

      this.strategies.clear();
      this.isInitialized = false;

      logger.info('StrategyEngine shutdown completed');

    } catch (error) {
      logger.error('Error during StrategyEngine shutdown:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      initialized: boolean;
      strategiesRunning: number;
      errorRate: number;
      averageLatency: number;
    };
  }> {
    const stats = this.getStats();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!this.isInitialized) {
      status = 'unhealthy';
    } else if (stats.errorRate > 10 || stats.averageLatency > 1000) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        initialized: this.isInitialized,
        strategiesRunning: stats.runningStrategies,
        errorRate: stats.errorRate,
        averageLatency: stats.averageLatency
      }
    };
  }
}

// Create singleton instance
export const strategyEngine = new StrategyEngineService();
export default strategyEngine;