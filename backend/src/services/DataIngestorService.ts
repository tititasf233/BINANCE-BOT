import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { BinanceApiService } from './BinanceApiService';

export interface KlineData {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
  isFinal: boolean;
}

export interface TickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  timestamp: number;
}

export interface StreamSubscription {
  symbol: string;
  interval?: string;
  type: 'kline' | 'ticker' | 'depth';
}

export interface MarketDataEvent {
  type: 'kline_closed' | 'ticker_update' | 'depth_update';
  symbol: string;
  data: any;
  timestamp: number;
}

export class DataIngestorService extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isConnecting = false;
  private isDestroyed = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongTime = 0;
  private binanceApiService: BinanceApiService | null = null;

  private readonly baseWsUrl: string;

  constructor(isTestnet = false) {
    super();
    this.baseWsUrl = isTestnet 
      ? process.env.BINANCE_TESTNET_WS_URL || 'wss://testnet.binance.vision/ws'
      : process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      logger.error('DataIngestor error:', error);
    });

    this.on('kline_closed', (data) => {
      logger.debug('Kline closed event', { symbol: data.symbol, interval: data.interval });
    });

    this.on('ticker_update', (data) => {
      logger.debug('Ticker update event', { symbol: data.symbol, price: data.price });
    });
  }

  /**
   * Initialize connection to Binance WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      logger.info('Connecting to Binance WebSocket...', { url: this.baseWsUrl });
      
      this.ws = new WebSocket(this.baseWsUrl);
      
      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('close', this.onClose.bind(this));
      this.ws.on('error', this.onError.bind(this));
      this.ws.on('pong', this.onPong.bind(this));

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }

  private onOpen(): void {
    logger.info('WebSocket connection established');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    
    this.startHeartbeat();
    this.resubscribeAll();
    
    this.emit('connected');
  }

  private onMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      this.processMessage(message);
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
    }
  }

  private onClose(code: number, reason: string): void {
    logger.warn('WebSocket connection closed', { code, reason: reason.toString() });
    
    this.stopHeartbeat();
    this.emit('disconnected', { code, reason });
    
    if (!this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  private onError(error: Error): void {
    logger.error('WebSocket error:', error);
    this.emit('error', error);
  }

  private onPong(): void {
    this.lastPongTime = Date.now();
  }

  private processMessage(message: any): void {
    if (message.stream && message.data) {
      const streamName = message.stream;
      const data = message.data;

      if (streamName.includes('@kline_')) {
        this.processKlineMessage(data);
      } else if (streamName.includes('@ticker')) {
        this.processTickerMessage(data);
      } else if (streamName.includes('@depth')) {
        this.processDepthMessage(data);
      }
    } else if (message.result === null && message.id) {
      // Subscription confirmation
      logger.debug('Subscription confirmed', { id: message.id });
    } else if (message.error) {
      logger.error('WebSocket message error:', message.error);
    }
  }

  private processKlineMessage(data: any): void {
    const kline = data.k;
    
    const klineData: KlineData = {
      symbol: kline.s,
      interval: kline.i,
      openTime: kline.t,
      closeTime: kline.T,
      open: kline.o,
      high: kline.h,
      low: kline.l,
      close: kline.c,
      volume: kline.v,
      trades: kline.n,
      isFinal: kline.x
    };

    // Only emit closed klines for strategy processing
    if (klineData.isFinal) {
      const event: MarketDataEvent = {
        type: 'kline_closed',
        symbol: klineData.symbol,
        data: klineData,
        timestamp: Date.now()
      };

      this.emit('kline_closed', klineData);
      this.emit('market_data', event);
    }
  }

  private processTickerMessage(data: any): void {
    const tickerData: TickerData = {
      symbol: data.s,
      price: data.c,
      priceChange: data.P,
      priceChangePercent: data.p,
      volume: data.v,
      timestamp: data.E
    };

    const event: MarketDataEvent = {
      type: 'ticker_update',
      symbol: tickerData.symbol,
      data: tickerData,
      timestamp: Date.now()
    };

    this.emit('ticker_update', tickerData);
    this.emit('market_data', event);
  }

  private processDepthMessage(data: any): void {
    const event: MarketDataEvent = {
      type: 'depth_update',
      symbol: data.s,
      data: data,
      timestamp: Date.now()
    };

    this.emit('depth_update', data);
    this.emit('market_data', event);
  }

  /**
   * Subscribe to kline stream for a symbol
   */
  async subscribeToKline(symbol: string, interval: string): Promise<void> {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const subscription: StreamSubscription = {
      symbol: symbol.toUpperCase(),
      interval,
      type: 'kline'
    };

    this.subscriptions.set(streamName, subscription);

    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.sendSubscription(streamName, 'SUBSCRIBE');
    }

    logger.info('Subscribed to kline stream', { symbol, interval });
  }

  /**
   * Subscribe to ticker stream for a symbol
   */
  async subscribeToTicker(symbol: string): Promise<void> {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const subscription: StreamSubscription = {
      symbol: symbol.toUpperCase(),
      type: 'ticker'
    };

    this.subscriptions.set(streamName, subscription);

    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.sendSubscription(streamName, 'SUBSCRIBE');
    }

    logger.info('Subscribed to ticker stream', { symbol });
  }

  /**
   * Unsubscribe from a stream
   */
  async unsubscribe(symbol: string, interval?: string): Promise<void> {
    const streamName = interval 
      ? `${symbol.toLowerCase()}@kline_${interval}`
      : `${symbol.toLowerCase()}@ticker`;

    this.subscriptions.delete(streamName);

    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.sendSubscription(streamName, 'UNSUBSCRIBE');
    }

    logger.info('Unsubscribed from stream', { symbol, interval });
  }

  private async sendSubscription(streamName: string, method: 'SUBSCRIBE' | 'UNSUBSCRIBE'): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      method,
      params: [streamName],
      id: Date.now()
    };

    this.ws.send(JSON.stringify(message));
  }

  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) {
      return;
    }

    logger.info('Resubscribing to all streams', { count: this.subscriptions.size });

    for (const [streamName] of this.subscriptions) {
      try {
        await this.sendSubscription(streamName, 'SUBSCRIBE');
      } catch (error) {
        logger.error('Failed to resubscribe to stream:', { streamName, error });
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      this.emit('max_reconnect_attempts_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    logger.info('Scheduling reconnection', { 
      attempt: this.reconnectAttempts, 
      delay,
      maxAttempts: this.maxReconnectAttempts 
    });

    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect().catch(error => {
          logger.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Check if we received a pong recently
        if (Date.now() - this.lastPongTime > 60000) { // 60 seconds
          logger.warn('No pong received, connection may be dead');
          this.ws.terminate();
          return;
        }

        // Send ping
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
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
    if (!this.binanceApiService) {
      // Use a basic API service for historical data (no auth required)
      this.binanceApiService = new BinanceApiService({
        apiKey: '',
        secretKey: '',
        isTestnet: this.baseWsUrl.includes('testnet')
      });
    }

    try {
      const rawKlines = await this.binanceApiService.getKlines(
        symbol,
        interval,
        limit,
        startTime,
        endTime
      );

      return rawKlines.map((kline: any[]) => ({
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

    } catch (error) {
      logger.error('Failed to get historical klines:', error);
      throw error;
    }
  }

  /**
   * Get current subscriptions
   */
  getSubscriptions(): StreamSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    subscriptions: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    this.isDestroyed = true;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.removeAllListeners();
      
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Normal closure');
      } else {
        this.ws.terminate();
      }
      
      this.ws = null;
    }

    this.subscriptions.clear();
    this.removeAllListeners();

    logger.info('DataIngestor disconnected and cleaned up');
  }
}

export default DataIngestorService;