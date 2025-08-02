import { EventEmitter } from 'events';
import { DataIngestorService, KlineData, TickerData } from './DataIngestorService';
import { messageBroker } from './MessageBrokerService';
import { redisService } from './RedisService';
import { logger } from '@/utils/logger';

export interface MarketDataSubscription {
  userId: number;
  symbol: string;
  interval?: string;
  type: 'kline' | 'ticker';
}

export interface CachedKlineData extends KlineData {
  cachedAt: number;
}

export interface CachedTickerData extends TickerData {
  cachedAt: number;
}

export class MarketDataManager extends EventEmitter {
  private dataIngestor: DataIngestorService;
  private activeSubscriptions: Map<string, Set<number>> = new Map(); // symbol:interval -> userIds
  private userSubscriptions: Map<number, Set<string>> = new Map(); // userId -> subscriptions
  private isInitialized = false;

  constructor(isTestnet = false) {
    super();
    this.dataIngestor = new DataIngestorService(isTestnet);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Data ingestor events
    this.dataIngestor.on('connected', () => {
      logger.info('Market data connection established');
      this.emit('connected');
    });

    this.dataIngestor.on('disconnected', (data) => {
      logger.warn('Market data connection lost', data);
      this.emit('disconnected', data);
    });

    this.dataIngestor.on('error', (error) => {
      logger.error('Market data error:', error);
      this.emit('error', error);
    });

    // Market data events
    this.dataIngestor.on('kline_closed', async (klineData: KlineData) => {
      await this.handleKlineData(klineData);
    });

    this.dataIngestor.on('ticker_update', async (tickerData: TickerData) => {
      await this.handleTickerData(tickerData);
    });

    // Message broker events
    this.on('error', (error) => {
      logger.error('MarketDataManager error:', error);
    });
  }

  /**
   * Initialize the market data manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize message broker
      await messageBroker.initialize();

      // Connect to data ingestor
      await this.dataIngestor.connect();

      this.isInitialized = true;
      logger.info('MarketDataManager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize MarketDataManager:', error);
      throw error;
    }
  }

  /**
   * Subscribe user to market data for a symbol
   */
  async subscribeUser(subscription: MarketDataSubscription): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MarketDataManager not initialized');
    }

    const { userId, symbol, interval, type } = subscription;
    const subscriptionKey = type === 'kline' && interval 
      ? `${symbol}:${interval}:kline`
      : `${symbol}:ticker`;

    try {
      // Add user to subscription tracking
      if (!this.activeSubscriptions.has(subscriptionKey)) {
        this.activeSubscriptions.set(subscriptionKey, new Set());
      }
      this.activeSubscriptions.get(subscriptionKey)!.add(userId);

      if (!this.userSubscriptions.has(userId)) {
        this.userSubscriptions.set(userId, new Set());
      }
      this.userSubscriptions.get(userId)!.add(subscriptionKey);

      // Subscribe to data stream if this is the first user for this subscription
      const subscribers = this.activeSubscriptions.get(subscriptionKey)!;
      if (subscribers.size === 1) {
        if (type === 'kline' && interval) {
          await this.dataIngestor.subscribeToKline(symbol, interval);
        } else if (type === 'ticker') {
          await this.dataIngestor.subscribeToTicker(symbol);
        }
      }

      logger.info('User subscribed to market data', {
        userId,
        symbol,
        interval,
        type,
        totalSubscribers: subscribers.size
      });

      // Send cached data if available
      await this.sendCachedData(userId, symbol, interval, type);

    } catch (error) {
      logger.error('Failed to subscribe user to market data:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from market data
   */
  async unsubscribeUser(userId: number, symbol?: string, interval?: string): Promise<void> {
    try {
      const userSubs = this.userSubscriptions.get(userId);
      if (!userSubs) {
        return; // User has no subscriptions
      }

      const subscriptionsToRemove: string[] = [];

      if (symbol) {
        // Unsubscribe from specific symbol
        const targetKey = interval 
          ? `${symbol}:${interval}:kline`
          : `${symbol}:ticker`;
        
        if (userSubs.has(targetKey)) {
          subscriptionsToRemove.push(targetKey);
        }
      } else {
        // Unsubscribe from all
        subscriptionsToRemove.push(...Array.from(userSubs));
      }

      for (const subscriptionKey of subscriptionsToRemove) {
        // Remove user from subscription
        const subscribers = this.activeSubscriptions.get(subscriptionKey);
        if (subscribers) {
          subscribers.delete(userId);

          // If no more subscribers, unsubscribe from data stream
          if (subscribers.size === 0) {
            const [sym, int, type] = subscriptionKey.split(':');
            if (type === 'kline') {
              await this.dataIngestor.unsubscribe(sym, int);
            } else {
              await this.dataIngestor.unsubscribe(sym);
            }
            this.activeSubscriptions.delete(subscriptionKey);
          }
        }

        userSubs.delete(subscriptionKey);
      }

      // Clean up user subscriptions if empty
      if (userSubs.size === 0) {
        this.userSubscriptions.delete(userId);
      }

      logger.info('User unsubscribed from market data', {
        userId,
        symbol,
        interval,
        removedSubscriptions: subscriptionsToRemove.length
      });

    } catch (error) {
      logger.error('Failed to unsubscribe user from market data:', error);
      throw error;
    }
  }

  /**
   * Handle incoming kline data
   */
  private async handleKlineData(klineData: KlineData): Promise<void> {
    try {
      const subscriptionKey = `${klineData.symbol}:${klineData.interval}:kline`;
      const subscribers = this.activeSubscriptions.get(subscriptionKey);

      if (!subscribers || subscribers.size === 0) {
        return; // No subscribers for this data
      }

      // Cache the data
      await this.cacheKlineData(klineData);

      // Publish to message broker
      await messageBroker.publish('market.kline.closed', {
        ...klineData,
        subscribers: Array.from(subscribers)
      }, 'MarketDataManager');

      logger.debug('Kline data processed', {
        symbol: klineData.symbol,
        interval: klineData.interval,
        subscribers: subscribers.size
      });

    } catch (error) {
      logger.error('Error handling kline data:', error);
    }
  }

  /**
   * Handle incoming ticker data
   */
  private async handleTickerData(tickerData: TickerData): Promise<void> {
    try {
      const subscriptionKey = `${tickerData.symbol}:ticker`;
      const subscribers = this.activeSubscriptions.get(subscriptionKey);

      if (!subscribers || subscribers.size === 0) {
        return; // No subscribers for this data
      }

      // Cache the data
      await this.cacheTickerData(tickerData);

      // Publish to message broker
      await messageBroker.publish('market.ticker.update', {
        ...tickerData,
        subscribers: Array.from(subscribers)
      }, 'MarketDataManager');

      logger.debug('Ticker data processed', {
        symbol: tickerData.symbol,
        price: tickerData.price,
        subscribers: subscribers.size
      });

    } catch (error) {
      logger.error('Error handling ticker data:', error);
    }
  }

  /**
   * Cache kline data in Redis
   */
  private async cacheKlineData(klineData: KlineData): Promise<void> {
    try {
      const cacheKey = `kline:${klineData.symbol}:${klineData.interval}`;
      const cachedData: CachedKlineData = {
        ...klineData,
        cachedAt: Date.now()
      };

      // Store latest kline
      await redisService.set(cacheKey, cachedData, 3600); // 1 hour expiry

      // Store in historical list (keep last 100)
      const historyKey = `${cacheKey}:history`;
      await redisService.lpush(historyKey, cachedData);
      
      // Trim to keep only last 100 entries
      await redisService.client.lTrim(historyKey, 0, 99);

    } catch (error) {
      logger.error('Error caching kline data:', error);
    }
  }

  /**
   * Cache ticker data in Redis
   */
  private async cacheTickerData(tickerData: TickerData): Promise<void> {
    try {
      const cacheKey = `ticker:${tickerData.symbol}`;
      const cachedData: CachedTickerData = {
        ...tickerData,
        cachedAt: Date.now()
      };

      // Store latest ticker
      await redisService.set(cacheKey, cachedData, 300); // 5 minutes expiry

    } catch (error) {
      logger.error('Error caching ticker data:', error);
    }
  }

  /**
   * Send cached data to newly subscribed user
   */
  private async sendCachedData(
    userId: number, 
    symbol: string, 
    interval?: string, 
    type?: string
  ): Promise<void> {
    try {
      if (type === 'kline' && interval) {
        const cacheKey = `kline:${symbol}:${interval}`;
        const cachedData = await redisService.get<CachedKlineData>(cacheKey, true);
        
        if (cachedData) {
          await messageBroker.publish('market.kline.cached', {
            ...cachedData,
            subscribers: [userId]
          }, 'MarketDataManager');
        }
      } else if (type === 'ticker') {
        const cacheKey = `ticker:${symbol}`;
        const cachedData = await redisService.get<CachedTickerData>(cacheKey, true);
        
        if (cachedData) {
          await messageBroker.publish('market.ticker.cached', {
            ...cachedData,
            subscribers: [userId]
          }, 'MarketDataManager');
        }
      }

    } catch (error) {
      logger.error('Error sending cached data:', error);
    }
  }

  /**
   * Get historical kline data
   */
  async getHistoricalKlines(
    symbol: string,
    interval: string,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<KlineData[]> {
    try {
      return await this.dataIngestor.getHistoricalKlines(
        symbol,
        interval,
        startTime,
        endTime,
        limit
      );
    } catch (error) {
      logger.error('Error getting historical klines:', error);
      throw error;
    }
  }

  /**
   * Get cached kline history
   */
  async getCachedKlineHistory(symbol: string, interval: string): Promise<CachedKlineData[]> {
    try {
      const historyKey = `kline:${symbol}:${interval}:history`;
      const history = await redisService.client.lRange(historyKey, 0, -1);
      
      return history.map(item => JSON.parse(item)).reverse(); // Reverse to get chronological order

    } catch (error) {
      logger.error('Error getting cached kline history:', error);
      throw error;
    }
  }

  /**
   * Get current market data statistics
   */
  getStats(): {
    activeSubscriptions: number;
    totalUsers: number;
    connectionStatus: any;
  } {
    return {
      activeSubscriptions: this.activeSubscriptions.size,
      totalUsers: this.userSubscriptions.size,
      connectionStatus: this.dataIngestor.getConnectionStatus()
    };
  }

  /**
   * Get user's subscriptions
   */
  getUserSubscriptions(userId: number): string[] {
    const userSubs = this.userSubscriptions.get(userId);
    return userSubs ? Array.from(userSubs) : [];
  }

  /**
   * Shutdown the market data manager
   */
  async shutdown(): Promise<void> {
    try {
      await this.dataIngestor.disconnect();
      await messageBroker.shutdown();
      
      this.activeSubscriptions.clear();
      this.userSubscriptions.clear();
      this.isInitialized = false;

      logger.info('MarketDataManager shutdown completed');

    } catch (error) {
      logger.error('Error during MarketDataManager shutdown:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const marketDataManager = new MarketDataManager();
export default marketDataManager;