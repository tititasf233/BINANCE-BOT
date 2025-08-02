import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '@/utils/logger';

export interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions: string[];
}

export interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }>;
  symbols: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    filters: any[];
  }>;
}

export interface BinanceApiCredentials {
  apiKey: string;
  secretKey: string;
  isTestnet?: boolean;
}

export class BinanceApiService {
  private apiKey: string;
  private secretKey: string;
  private baseURL: string;
  private client: AxiosInstance;

  constructor(credentials: BinanceApiCredentials) {
    this.apiKey = credentials.apiKey;
    this.secretKey = credentials.secretKey;
    
    // Use testnet or mainnet URL
    this.baseURL = credentials.isTestnet 
      ? process.env.BINANCE_TESTNET_API_URL || 'https://testnet.binance.vision'
      : process.env.BINANCE_API_URL || 'https://api.binance.com';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Binance API request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Binance API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Binance API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Binance API response error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  private createSignedParams(params: Record<string, any> = {}): string {
    const timestamp = Date.now();
    const queryParams = {
      ...params,
      timestamp
    };

    const queryString = Object.keys(queryParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const signature = this.createSignature(queryString);
    
    return `${queryString}&signature=${signature}`;
  }

  /**
   * Test API key validity by getting account information
   */
  async testApiKey(): Promise<{
    isValid: boolean;
    error?: string;
    accountInfo?: BinanceAccountInfo;
  }> {
    try {
      const params = this.createSignedParams();
      const response = await this.client.get(`/api/v3/account?${params}`);
      
      return {
        isValid: true,
        accountInfo: response.data
      };
    } catch (error: any) {
      logger.error('API key test failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        isValid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    try {
      const params = this.createSignedParams();
      const response = await this.client.get(`/api/v3/account?${params}`);
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get account info:', error);
      throw new Error('Failed to get account information');
    }
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(): Promise<BinanceExchangeInfo> {
    try {
      const response = await this.client.get('/api/v3/exchangeInfo');
      return response.data;
    } catch (error) {
      logger.error('Failed to get exchange info:', error);
      throw new Error('Failed to get exchange information');
    }
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<number> {
    try {
      const response = await this.client.get('/api/v3/time');
      return response.data.serverTime;
    } catch (error) {
      logger.error('Failed to get server time:', error);
      throw new Error('Failed to get server time');
    }
  }

  /**
   * Get symbol price ticker
   */
  async getSymbolPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    try {
      const response = await this.client.get('/api/v3/ticker/price', {
        params: { symbol }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get symbol price:', error);
      throw new Error(`Failed to get price for ${symbol}`);
    }
  }

  /**
   * Get 24hr ticker statistics
   */
  async get24hrTicker(symbol?: string): Promise<any> {
    try {
      const params = symbol ? { symbol } : {};
      const response = await this.client.get('/api/v3/ticker/24hr', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get 24hr ticker:', error);
      throw new Error('Failed to get 24hr ticker');
    }
  }

  /**
   * Get kline/candlestick data
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<any[]> {
    try {
      const params: any = { symbol, interval };
      if (limit) params.limit = limit;
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await this.client.get('/api/v3/klines', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get klines:', error);
      throw new Error(`Failed to get klines for ${symbol}`);
    }
  }

  /**
   * Get current open orders
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    try {
      const params = symbol ? { symbol } : {};
      const signedParams = this.createSignedParams(params);
      
      const response = await this.client.get(`/api/v3/openOrders?${signedParams}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get open orders:', error);
      throw new Error('Failed to get open orders');
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(
    symbol: string,
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<any[]> {
    try {
      const params: any = { symbol };
      if (limit) params.limit = limit;
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const signedParams = this.createSignedParams(params);
      const response = await this.client.get(`/api/v3/allOrders?${signedParams}`);
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get order history:', error);
      throw new Error(`Failed to get order history for ${symbol}`);
    }
  }

  /**
   * Check if symbol exists and is tradeable
   */
  async isSymbolTradeable(symbol: string): Promise<boolean> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
      
      return symbolInfo ? symbolInfo.status === 'TRADING' : false;
    } catch (error) {
      logger.error('Failed to check symbol tradeability:', error);
      return false;
    }
  }

  /**
   * Get API key permissions
   */
  async getApiKeyPermissions(): Promise<{
    canTrade: boolean;
    canWithdraw: boolean;
    canDeposit: boolean;
    permissions: string[];
  }> {
    try {
      const accountInfo = await this.getAccountInfo();
      
      return {
        canTrade: accountInfo.canTrade,
        canWithdraw: accountInfo.canWithdraw,
        canDeposit: accountInfo.canDeposit,
        permissions: accountInfo.permissions
      };
    } catch (error) {
      logger.error('Failed to get API key permissions:', error);
      throw new Error('Failed to get API key permissions');
    }
  }
}

export default BinanceApiService;