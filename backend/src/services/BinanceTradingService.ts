import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '@/utils/logger';

export interface BinanceOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT_LIMIT';
  quantity?: string;
  quoteOrderQty?: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  newClientOrderId?: string;
}

export interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

export interface BinanceOCORequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  stopPrice: string;
  stopLimitPrice: string;
  stopLimitTimeInForce?: 'GTC' | 'IOC' | 'FOK';
  listClientOrderId?: string;
  limitClientOrderId?: string;
  stopClientOrderId?: string;
}

export interface BinanceOCOResponse {
  orderListId: number;
  contingencyType: string;
  listStatusType: string;
  listOrderStatus: string;
  listClientOrderId: string;
  transactionTime: number;
  symbol: string;
  orders: Array<{
    symbol: string;
    orderId: number;
    clientOrderId: string;
  }>;
  orderReports: Array<{
    symbol: string;
    orderId: number;
    orderListId: number;
    clientOrderId: string;
    price: string;
    origQty: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    status: string;
    timeInForce: string;
    type: string;
    side: string;
    stopPrice?: string;
  }>;
}

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

export class BinanceTradingService {
  private apiKey: string;
  private secretKey: string;
  private baseURL: string;
  private client: AxiosInstance;

  constructor(apiKey: string, secretKey: string, isTestnet = false) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    
    this.baseURL = isTestnet 
      ? process.env.BINANCE_TESTNET_API_URL || 'https://testnet.binance.vision'
      : process.env.BINANCE_API_URL || 'https://api.binance.com';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Binance trading request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Binance trading request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Binance trading response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Binance trading response error:', {
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
   * Get asset balance
   */
  async getAssetBalance(asset: string): Promise<{ free: string; locked: string }> {
    try {
      const accountInfo = await this.getAccountInfo();
      const balance = accountInfo.balances.find(b => b.asset === asset);
      
      if (!balance) {
        return { free: '0', locked: '0' };
      }

      return {
        free: balance.free,
        locked: balance.locked
      };
    } catch (error) {
      logger.error('Failed to get asset balance:', error);
      throw error;
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(request: BinanceOrderRequest): Promise<BinanceOrderResponse> {
    try {
      const params = this.createSignedParams(request);
      const response = await this.client.post('/api/v3/order', params);
      
      logger.info('Market order placed', {
        symbol: request.symbol,
        side: request.side,
        orderId: response.data.orderId
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to place market order:', {
        request,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to place market order: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(request: BinanceOrderRequest): Promise<BinanceOrderResponse> {
    try {
      if (!request.price) {
        throw new Error('Price is required for limit orders');
      }

      const params = this.createSignedParams({
        ...request,
        timeInForce: request.timeInForce || 'GTC'
      });
      
      const response = await this.client.post('/api/v3/order', params);
      
      logger.info('Limit order placed', {
        symbol: request.symbol,
        side: request.side,
        price: request.price,
        orderId: response.data.orderId
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to place limit order:', {
        request,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to place limit order: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Place OCO (One-Cancels-Other) order
   */
  async placeOCOOrder(request: BinanceOCORequest): Promise<BinanceOCOResponse> {
    try {
      const params = this.createSignedParams({
        ...request,
        stopLimitTimeInForce: request.stopLimitTimeInForce || 'GTC'
      });
      
      const response = await this.client.post('/api/v3/order/oco', params);
      
      logger.info('OCO order placed', {
        symbol: request.symbol,
        side: request.side,
        orderListId: response.data.orderListId,
        price: request.price,
        stopPrice: request.stopPrice
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to place OCO order:', {
        request,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to place OCO order: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    try {
      const params = this.createSignedParams({ symbol, orderId });
      const response = await this.client.delete(`/api/v3/order?${params}`);
      
      logger.info('Order cancelled', { symbol, orderId });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to cancel order:', {
        symbol,
        orderId,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to cancel order: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Cancel OCO order
   */
  async cancelOCOOrder(symbol: string, orderListId: number): Promise<any> {
    try {
      const params = this.createSignedParams({ symbol, orderListId });
      const response = await this.client.delete(`/api/v3/orderList?${params}`);
      
      logger.info('OCO order cancelled', { symbol, orderListId });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to cancel OCO order:', {
        symbol,
        orderListId,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to cancel OCO order: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: number): Promise<any> {
    try {
      const params = this.createSignedParams({ symbol, orderId });
      const response = await this.client.get(`/api/v3/order?${params}`);
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get order status:', {
        symbol,
        orderId,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to get order status: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    try {
      const params = symbol ? { symbol } : {};
      const signedParams = this.createSignedParams(params);
      
      const response = await this.client.get(`/api/v3/openOrders?${signedParams}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get open orders:', {
        symbol,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to get open orders: ${error.response?.data?.msg || error.message}`);
    }
  }

  /**
   * Get symbol exchange info
   */
  async getSymbolInfo(symbol: string): Promise<any> {
    try {
      const response = await this.client.get('/api/v3/exchangeInfo');
      const symbolInfo = response.data.symbols.find((s: any) => s.symbol === symbol);
      
      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      return symbolInfo;
    } catch (error) {
      logger.error('Failed to get symbol info:', error);
      throw error;
    }
  }

  /**
   * Calculate quantity based on USD amount
   */
  async calculateQuantityFromUSD(symbol: string, usdAmount: number): Promise<string> {
    try {
      // Get current price
      const response = await this.client.get('/api/v3/ticker/price', {
        params: { symbol }
      });
      
      const currentPrice = parseFloat(response.data.price);
      const quantity = usdAmount / currentPrice;

      // Get symbol info for precision
      const symbolInfo = await this.getSymbolInfo(symbol);
      const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
      
      if (lotSizeFilter) {
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const precision = stepSize.toString().split('.')[1]?.length || 0;
        return quantity.toFixed(precision);
      }

      return quantity.toFixed(8); // Default precision
    } catch (error) {
      logger.error('Failed to calculate quantity from USD:', error);
      throw error;
    }
  }

  /**
   * Validate order parameters
   */
  async validateOrderParams(request: BinanceOrderRequest): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Get symbol info
      const symbolInfo = await this.getSymbolInfo(request.symbol);
      
      // Check if symbol is trading
      if (symbolInfo.status !== 'TRADING') {
        errors.push(`Symbol ${request.symbol} is not currently trading`);
      }

      // Validate quantity
      if (request.quantity) {
        const quantity = parseFloat(request.quantity);
        const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
        
        if (lotSizeFilter) {
          const minQty = parseFloat(lotSizeFilter.minQty);
          const maxQty = parseFloat(lotSizeFilter.maxQty);
          
          if (quantity < minQty) {
            errors.push(`Quantity ${quantity} is below minimum ${minQty}`);
          }
          
          if (quantity > maxQty) {
            errors.push(`Quantity ${quantity} is above maximum ${maxQty}`);
          }
        }
      }

      // Validate price for limit orders
      if (request.type === 'LIMIT' && request.price) {
        const price = parseFloat(request.price);
        const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
        
        if (priceFilter) {
          const minPrice = parseFloat(priceFilter.minPrice);
          const maxPrice = parseFloat(priceFilter.maxPrice);
          
          if (price < minPrice) {
            errors.push(`Price ${price} is below minimum ${minPrice}`);
          }
          
          if (price > maxPrice) {
            errors.push(`Price ${price} is above maximum ${maxPrice}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      logger.error('Error validating order params:', error);
      return {
        isValid: false,
        errors: ['Failed to validate order parameters']
      };
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
      throw error;
    }
  }
}

export default BinanceTradingService;