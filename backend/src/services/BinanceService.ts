import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface BinanceCredentials {
  apiKey: string;
  secretKey: string;
  isTestnet?: boolean;
}

export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quotePrecision: number;
  orderTypes: string[];
  filters: any[];
}

export interface TickerPrice {
  symbol: string;
  price: string;
}

export interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
  quantity?: string;
  quoteOrderQty?: string; // Para ordens MARKET usando valor em quote asset
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  newClientOrderId?: string;
  icebergQty?: string;
  newOrderRespType?: 'ACK' | 'RESULT' | 'FULL';
  recvWindow?: number;
}

export interface OrderResponse {
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

// Mock data storage for demo mode
interface MockOrderStorage {
  orders: Map<number, any>;
  nextOrderId: number;
}

// Global mock storage (in production, this would be in Redis or database)
const mockStorage: MockOrderStorage = {
  orders: new Map(),
  nextOrderId: 100000000
};

export class BinanceService {
  private client: AxiosInstance;
  private credentials: BinanceCredentials;
  private baseUrl: string;
  private isDemoMode: boolean;
  private useLocalMock: boolean;

  constructor(credentials: BinanceCredentials) {
    this.credentials = credentials;
    this.isDemoMode = credentials.isTestnet || false;
    // Permite alternar entre mock local no modo demo e Testnet real
    this.useLocalMock = (process.env.DEMO_USE_LOCAL_MOCK || 'false').toLowerCase() === 'true';
    this.baseUrl = credentials.isTestnet 
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com';

    // Inicializar mock APENAS se explicitamente habilitado
    if (this.isDemoMode && this.useLocalMock && mockStorage.orders.size === 0) {
      this.initializeMockData();
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para logs
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
        logger.error('Binance API request error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Binance API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Binance API response error', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  // Limpeza global do mock storage (independente de instância/modo)
  public static resetMockStorage(): void {
    mockStorage.orders.clear();
    mockStorage.nextOrderId = 100000000;
    logger.info('Global mock storage reset', {
      ordersCount: mockStorage.orders.size,
      nextOrderId: mockStorage.nextOrderId
    });
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.credentials.secretKey)
      .update(queryString)
      .digest('hex');
  }

  private createSignedParams(params: Record<string, any> = {}): string {
    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString()
    }).toString();

    const signature = this.createSignature(queryString);
    return `${queryString}&signature=${signature}`;
  }

  // Initialize mock data for demo mode
  private initializeMockData(): void {
    // Limpar storage existente primeiro
    mockStorage.orders.clear();
    
    // Add some initial mock orders (opcional - pode começar vazio)
    const initialOrders = [
      // Comentado para começar com storage limpo
      // {
      //   orderId: 123456789,
      //   symbol: 'BTCUSDT',
      //   side: 'BUY',
      //   type: 'LIMIT',
      //   origQty: '0.001',
      //   price: '45000.00',
      //   status: 'NEW',
      //   timeInForce: 'GTC',
      //   time: Date.now() - 3600000,
      //   updateTime: Date.now() - 3600000,
      //   isWorking: true
      // }
    ];

    initialOrders.forEach(order => {
      mockStorage.orders.set(order.orderId, order);
    });
    
    logger.info('Mock storage initialized', { 
      ordersCount: mockStorage.orders.size,
      nextOrderId: mockStorage.nextOrderId 
    });
  }

  // Função para limpar completamente o mock storage (útil para testes)
  public clearMockStorage(): void {
    // Limpar apenas quando o mock local estiver em uso
    if (this.useLocalMock) {
      BinanceService.resetMockStorage();
    }
  }

  // Add order to mock storage
  private addMockOrder(order: any): void {
    if (this.isDemoMode) {
      mockStorage.orders.set(order.orderId, order);
      logger.info('Added mock order to storage', { orderId: order.orderId, symbol: order.symbol });
    }
  }

  // Remove order from mock storage
  private removeMockOrder(orderId: number): void {
    if (this.isDemoMode) {
      const removed = mockStorage.orders.delete(orderId);
      logger.info('Removed mock order from storage', { orderId, removed });
    }
  }

  // Get next order ID for mock orders
  private getNextMockOrderId(): number {
    return mockStorage.nextOrderId++;
  }

  // Métodos para dados simulados (modo demo)
  private generateMockAccountInfo(): AccountInfo {
    return {
      makerCommission: 10,
      takerCommission: 10,
      buyerCommission: 0,
      sellerCommission: 0,
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      balances: [
        { asset: 'BTC', free: '0.50000000', locked: '0.00000000' },
        { asset: 'ETH', free: '5.25000000', locked: '0.00000000' },
        { asset: 'BNB', free: '100.00000000', locked: '0.00000000' },
        { asset: 'USDT', free: '10000.00000000', locked: '500.00000000' },
        { asset: 'ADA', free: '1000.00000000', locked: '0.00000000' },
        { asset: 'SOL', free: '25.00000000', locked: '0.00000000' },
        { asset: 'XRP', free: '2000.00000000', locked: '0.00000000' },
        { asset: 'DOT', free: '50.00000000', locked: '0.00000000' },
        { asset: 'LINK', free: '75.00000000', locked: '0.00000000' },
        { asset: 'LTC', free: '10.00000000', locked: '0.00000000' }
      ]
    };
  }

  private generateMockOpenOrders(): any[] {
    return [
      {
        symbol: 'BTCUSDT',
        orderId: 123456789,
        orderListId: -1,
        clientOrderId: 'demo_order_1',
        price: '45000.00',
        origQty: '0.001',
        executedQty: '0.000',
        cummulativeQuoteQty: '0.00',
        status: 'NEW',
        timeInForce: 'GTC',
        type: 'LIMIT',
        side: 'BUY',
        stopPrice: '0.00',
        icebergQty: '0.00',
        time: Date.now() - 3600000,
        updateTime: Date.now() - 3600000,
        isWorking: true,
        origQuoteOrderQty: '0.00'
      },
      {
        symbol: 'ETHUSDT',
        orderId: 123456790,
        orderListId: -1,
        clientOrderId: 'demo_order_2',
        price: '3200.00',
        origQty: '0.1',
        executedQty: '0.000',
        cummulativeQuoteQty: '0.00',
        status: 'NEW',
        timeInForce: 'GTC',
        type: 'LIMIT',
        side: 'SELL',
        stopPrice: '0.00',
        icebergQty: '0.00',
        time: Date.now() - 1800000,
        updateTime: Date.now() - 1800000,
        isWorking: true,
        origQuoteOrderQty: '0.00'
      }
    ];
  }

  private generateMockPrice(symbol: string): TickerPrice {
    const mockPrices: Record<string, string> = {
      'BTCUSDT': '43250.50',
      'ETHUSDT': '2650.75',
      'BNBUSDT': '315.20',
      'ADAUSDT': '0.4850',
      'SOLUSDT': '98.45',
      'XRPUSDT': '0.5920',
      'DOTUSDT': '7.85',
      'LINKUSDT': '14.25',
      'LTCUSDT': '72.30',
      'BCHUSDT': '245.80'
    };

    return {
      symbol,
      price: mockPrices[symbol] || '1.00000000'
    };
  }

  private generateMockOrderResponse(orderRequest: OrderRequest): OrderResponse {
    const mockPrice = this.generateMockPrice(orderRequest.symbol);
    const orderId = this.getNextMockOrderId();
    const executedQty = orderRequest.type === 'MARKET' ? (orderRequest.quantity || '0') : '0';
    const status = orderRequest.type === 'MARKET' ? 'FILLED' : 'NEW';
    const currentTime = Date.now();

    const orderResponse: OrderResponse = {
      symbol: orderRequest.symbol,
      orderId,
      orderListId: -1,
      clientOrderId: orderRequest.newClientOrderId || `demo_${orderId}`,
      transactTime: currentTime,
      price: orderRequest.price || mockPrice.price,
      origQty: orderRequest.quantity || '0',
      executedQty,
      cummulativeQuoteQty: orderRequest.type === 'MARKET' ? 
        (parseFloat(executedQty) * parseFloat(mockPrice.price)).toString() : '0',
      status,
      timeInForce: orderRequest.timeInForce || 'GTC',
      type: orderRequest.type,
      side: orderRequest.side,
      fills: orderRequest.type === 'MARKET' ? [{
        price: mockPrice.price,
        qty: executedQty,
        commission: (parseFloat(executedQty) * 0.001).toString(),
        commissionAsset: orderRequest.side === 'BUY' ? 
          orderRequest.symbol.replace('USDT', '') : 'USDT'
      }] : []
    };

    // Add to mock storage if it's a pending order
    if (status === 'NEW') {
      const mockOrder = {
        orderId,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        origQty: orderRequest.quantity || '0',
        price: orderRequest.price || mockPrice.price,
        status,
        timeInForce: orderRequest.timeInForce || 'GTC',
        time: currentTime,
        updateTime: currentTime,
        isWorking: true
      };
      this.addMockOrder(mockOrder);
    }

    return orderResponse;
  }

  // Métodos públicos (não requerem assinatura)
  async getExchangeInfo(): Promise<{ symbols: SymbolInfo[] }> {
    try {
      const response = await this.client.get('/api/v3/exchangeInfo');
      return response.data;
    } catch (error) {
      logger.error('Failed to get exchange info', error as any);
      throw new Error('Failed to get exchange info');
    }
  }

  async getSymbolPrice(symbol: string): Promise<TickerPrice> {
    if (this.isDemoMode && this.useLocalMock) {
      logger.info('Returning mock price for demo mode', { symbol });
      return this.generateMockPrice(symbol);
    }

    try {
      const response = await this.client.get('/api/v3/ticker/price', {
        params: { symbol }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get symbol price', { symbol, error: error as any });
      throw new Error(`Failed to get price for ${symbol}`);
    }
  }

  async getAllPrices(): Promise<TickerPrice[]> {
    try {
      const response = await this.client.get('/api/v3/ticker/price');
      return response.data;
    } catch (error) {
      logger.error('Failed to get all prices', error as any);
      throw new Error('Failed to get all prices');
    }
  }

  async get24hrStats(symbol?: string): Promise<any> {
    try {
      const params = symbol ? { symbol } : {};
      const response = await this.client.get('/api/v3/ticker/24hr', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get 24hr stats', { symbol, error: error as any });
      throw new Error('Failed to get 24hr stats');
    }
  }

  // Métodos privados (requerem assinatura)
  async getAccountInfo(): Promise<AccountInfo> {
    if (this.isDemoMode && this.useLocalMock) {
      logger.info('Returning mock account info for demo mode');
      return this.generateMockAccountInfo();
    }

    try {
      const signedParams = this.createSignedParams();
      const response = await this.client.get(`/api/v3/account?${signedParams}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get account info', error as any);
      throw new Error('Failed to get account info');
    }
  }

  async createOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.info(`[${requestId}] CREATE ORDER INICIADO`, { 
      orderRequest,
      isDemoMode: this.isDemoMode,
      mockStorageSizeBefore: mockStorage.orders.size 
    });

    if (this.isDemoMode && this.useLocalMock) {
      logger.info(`[${requestId}] Modo demo ativo - criando ordem mock`);
      logger.debug(`[${requestId}] Estado do mock storage antes:`, {
        totalOrders: mockStorage.orders.size,
        nextOrderId: mockStorage.nextOrderId,
        existingOrderIds: Array.from(mockStorage.orders.keys())
      });

      const mockResponse = this.generateMockOrderResponse(orderRequest);
      
      logger.info(`[${requestId}] ORDEM MOCK CRIADA:`, {
        orderId: mockResponse.orderId,
        symbol: mockResponse.symbol,
        side: mockResponse.side,
        type: mockResponse.type,
        quantity: mockResponse.origQty,
        price: mockResponse.price,
        status: mockResponse.status,
        mockStorageSizeAfter: mockStorage.orders.size
      });

      logger.debug(`[${requestId}] Estado do mock storage depois:`, {
        totalOrders: mockStorage.orders.size,
        nextOrderId: mockStorage.nextOrderId,
        allOrderIds: Array.from(mockStorage.orders.keys()),
        newOrderInStorage: mockStorage.orders.has(mockResponse.orderId)
      });

      return mockResponse;
    }

    try {
      // Validar parâmetros obrigatórios conforme documentação oficial
      if (!orderRequest.symbol || !orderRequest.side || !orderRequest.type) {
        throw new Error('symbol, side, and type are mandatory parameters');
      }

      // Para ordens MARKET, quantity ou quoteOrderQty é obrigatório
      if (orderRequest.type === 'MARKET') {
        if (!orderRequest.quantity && !orderRequest.quoteOrderQty) {
          throw new Error('Either quantity or quoteOrderQty is required for MARKET orders');
        }
      }

      // Para ordens LIMIT, quantity e price são obrigatórios
      if (orderRequest.type === 'LIMIT') {
        if (!orderRequest.quantity || !orderRequest.price) {
          throw new Error('quantity and price are required for LIMIT orders');
        }
        // timeInForce é obrigatório para LIMIT orders
        if (!orderRequest.timeInForce) {
          orderRequest.timeInForce = 'GTC'; // Default
        }
      }

      // Para ordens STOP_LOSS e TAKE_PROFIT, quantity e stopPrice são obrigatórios
      if (['STOP_LOSS', 'TAKE_PROFIT'].includes(orderRequest.type)) {
        if (!orderRequest.quantity || !orderRequest.stopPrice) {
          throw new Error('quantity and stopPrice are required for STOP_LOSS/TAKE_PROFIT orders');
        }
      }

      // Para ordens STOP_LOSS_LIMIT e TAKE_PROFIT_LIMIT
      if (['STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'].includes(orderRequest.type)) {
        if (!orderRequest.quantity || !orderRequest.price || !orderRequest.stopPrice) {
          throw new Error('quantity, price, and stopPrice are required for STOP_LOSS_LIMIT/TAKE_PROFIT_LIMIT orders');
        }
        if (!orderRequest.timeInForce) {
          orderRequest.timeInForce = 'GTC'; // Default
        }
      }

      // Limpar parâmetros undefined/null
      const cleanParams = Object.fromEntries(
        Object.entries(orderRequest).filter(([_, value]) => value !== undefined && value !== null && value !== '')
      );

      const signedParams = this.createSignedParams(cleanParams);
      const response = await this.client.post(`/api/v3/order?${signedParams}`);
      
      logger.info('Order created successfully', {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        quantity: orderRequest.quantity,
        orderId: response.data.orderId
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create order', { orderRequest, error: error as any });
      
      // Melhor tratamento de erros da Binance API
      if (error.response?.data?.msg) {
        throw new Error(`Binance API Error: ${error.response.data.msg}`);
      }
      
      throw new Error('Failed to create order');
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.info(`[${requestId}] CANCEL ORDER INICIADO`, { 
      symbol, 
      orderId,
      isDemoMode: this.isDemoMode,
      mockStorageSizeBefore: mockStorage.orders.size 
    });

    if (this.isDemoMode) {
      logger.info(`[${requestId}] Modo demo ativo - cancelando ordem mock`);
      logger.debug(`[${requestId}] Estado do mock storage antes:`, {
        totalOrders: mockStorage.orders.size,
        allOrderIds: Array.from(mockStorage.orders.keys()),
        targetOrderExists: mockStorage.orders.has(orderId)
      });
      
      // Get the order from storage
      const existingOrder = mockStorage.orders.get(orderId);
      if (!existingOrder) {
        logger.error(`[${requestId}] Ordem ${orderId} não encontrada no mock storage`);
        logger.debug(`[${requestId}] Ordens disponíveis:`, Array.from(mockStorage.orders.keys()));
        throw new Error(`Order ${orderId} not found`);
      }

      logger.info(`[${requestId}] Ordem encontrada no mock storage:`, {
        orderId: existingOrder.orderId,
        symbol: existingOrder.symbol,
        side: existingOrder.side,
        status: existingOrder.status,
        quantity: existingOrder.origQty,
        price: existingOrder.price
      });

      // Remove from storage
      this.removeMockOrder(orderId);

      logger.info(`[${requestId}] ORDEM MOCK CANCELADA:`, {
        orderId,
        symbol: existingOrder.symbol,
        mockStorageSizeAfter: mockStorage.orders.size,
        orderRemovedFromStorage: !mockStorage.orders.has(orderId)
      });

      logger.debug(`[${requestId}] Estado do mock storage depois:`, {
        totalOrders: mockStorage.orders.size,
        allOrderIds: Array.from(mockStorage.orders.keys()),
        targetOrderExists: mockStorage.orders.has(orderId)
      });

      return {
        symbol: existingOrder.symbol,
        origClientOrderId: `demo_${orderId}`,
        orderId,
        orderListId: -1,
        clientOrderId: `cancel_${orderId}`,
        price: existingOrder.price,
        origQty: existingOrder.origQty,
        executedQty: '0.00000000',
        cummulativeQuoteQty: '0.00000000',
        status: 'CANCELED',
        timeInForce: existingOrder.timeInForce,
        type: existingOrder.type,
        side: existingOrder.side
      };
    }

    try {
      const signedParams = this.createSignedParams({ symbol, orderId });
      const response = await this.client.delete(`/api/v3/order?${signedParams}`);
      
      logger.info('Order cancelled successfully', { symbol, orderId });
      return response.data;
    } catch (error) {
      logger.error('Failed to cancel order', { symbol, orderId, error: error as any });
      throw new Error('Failed to cancel order');
    }
  }

  async getOrder(symbol: string, orderId: number): Promise<any> {
    try {
      const signedParams = this.createSignedParams({ symbol, orderId });
      const response = await this.client.get(`/api/v3/order?${signedParams}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get order', { symbol, orderId, error: error as any });
      throw new Error('Failed to get order');
    }
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.info(`[${requestId}] GET OPEN ORDERS INICIADO`, { 
      symbol, 
      isDemoMode: this.isDemoMode,
      useLocalMock: this.useLocalMock,
      mockStorageSize: mockStorage.orders.size 
    });

    if (this.isDemoMode && this.useLocalMock) {
      logger.info(`[${requestId}] Modo demo ativo - usando mock storage (local)`);
      logger.debug(`[${requestId}] Mock storage contents:`, {
        totalOrders: mockStorage.orders.size,
        orderIds: Array.from(mockStorage.orders.keys()),
        orders: Array.from(mockStorage.orders.values())
      });

      const allOrders = Array.from(mockStorage.orders.values()).filter(order => {
        const isActive = order.status === 'NEW' || order.status === 'PARTIALLY_FILLED';
        logger.debug(`[${requestId}] Filtering order ${order.orderId}: status=${order.status}, isActive=${isActive}`);
        return isActive;
      });

      const filteredOrders = symbol ? allOrders.filter(order => {
        const matches = order.symbol === symbol;
        logger.debug(`[${requestId}] Symbol filter for order ${order.orderId}: ${order.symbol} === ${symbol} = ${matches}`);
        return matches;
      }) : allOrders;

      logger.info(`[${requestId}] DEMO MODE RESULT:`, {
        totalInStorage: mockStorage.orders.size,
        activeOrders: allOrders.length,
        filteredOrders: filteredOrders.length,
        symbol,
        orders: filteredOrders.map(o => ({
          orderId: o.orderId,
          symbol: o.symbol,
          side: o.side,
          status: o.status,
          quantity: o.origQty,
          price: o.price
        }))
      });

      return filteredOrders;
    }

    try {
      const params = symbol ? { symbol } : {};
      logger.info(`[${requestId}] Fazendo requisição real para Binance API`, { params });
      
      const signedParams = this.createSignedParams(params);
      const response = await this.client.get(`/api/v3/openOrders?${signedParams}`);
      
      logger.info(`[${requestId}] REAL API RESULT:`, {
        ordersCount: response.data.length,
        orders: response.data.map((o: any) => ({
          orderId: o.orderId,
          symbol: o.symbol,
          side: o.side,
          status: o.status,
          quantity: o.origQty,
          price: o.price
        }))
      });

      return response.data;
    } catch (error) {
      logger.error(`[${requestId}] Failed to get open orders`, { symbol, error: error as any });
      throw new Error('Failed to get open orders');
    }
  }

  async getOrderHistory(symbol: string, limit: number = 500): Promise<any[]> {
    try {
      const signedParams = this.createSignedParams({ symbol, limit });
      const response = await this.client.get(`/api/v3/allOrders?${signedParams}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get order history', { symbol, limit, error: error as any });
      throw new Error('Failed to get order history');
    }
  }

  async testConnectivity(): Promise<boolean> {
    if (this.isDemoMode) {
      logger.info('Mock connectivity test for demo mode');
      return true;
    }

    try {
      await this.client.get('/api/v3/ping');
      return true;
    } catch (error) {
      logger.error('Binance connectivity test failed', error as any);
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    if (this.isDemoMode) {
      logger.info('Mock server time for demo mode');
      return Date.now();
    }

    try {
      const response = await this.client.get('/api/v3/time');
      return response.data.serverTime;
    } catch (error) {
      logger.error('Failed to get server time', error as any);
      throw new Error('Failed to get server time');
    }
  }

  // Obter trades de uma conta (myTrades endpoint)
  async getMyTrades(symbol: string, limit: number = 500, fromId?: number): Promise<any[]> {
    try {
      const params: any = { symbol, limit };
      if (fromId) params.fromId = fromId;
      
      const signedParams = this.createSignedParams(params);
      const response = await this.client.get(`/api/v3/myTrades?${signedParams}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get my trades', { symbol, limit, error: error as any });
      throw new Error('Failed to get my trades');
    }
  }

  // Obter informações detalhadas de um símbolo
  async getSymbolInfo(symbol: string): Promise<SymbolInfo | null> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      return exchangeInfo.symbols.find(s => s.symbol === symbol) || null;
    } catch (error) {
      logger.error('Failed to get symbol info', { symbol, error: error as any });
      throw new Error('Failed to get symbol info');
    }
  }

  // Obter book de ofertas (order book)
  async getOrderBook(symbol: string, limit: number = 100): Promise<any> {
    try {
      const response = await this.client.get('/api/v3/depth', {
        params: { symbol, limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get order book', { symbol, limit, error: error as any });
      throw new Error('Failed to get order book');
    }
  }

  // Obter trades recentes de um símbolo
  async getRecentTrades(symbol: string, limit: number = 500): Promise<any[]> {
    try {
      const response = await this.client.get('/api/v3/trades', {
        params: { symbol, limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get recent trades', { symbol, limit, error: error as any });
      throw new Error('Failed to get recent trades');
    }
  }

  // Obter dados de kline/candlestick
  async getKlines(symbol: string, interval: string, limit: number = 500, startTime?: number, endTime?: number): Promise<any[]> {
    try {
      const params: any = { symbol, interval, limit };
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await this.client.get('/api/v3/klines', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get klines', { symbol, interval, limit, error: error as any });
      throw new Error('Failed to get klines');
    }
  }

  // Testar ordem (sem executar)
  async testOrder(orderRequest: OrderRequest): Promise<any> {
    if (this.isDemoMode) {
      logger.info('Mock order test for demo mode', orderRequest);
      return {}; // Teste sempre passa no modo demo
    }

    try {
      const cleanParams = Object.fromEntries(
        Object.entries(orderRequest).filter(([_, value]) => value !== undefined && value !== null && value !== '')
      );

      const signedParams = this.createSignedParams(cleanParams);
      const response = await this.client.post(`/api/v3/order/test?${signedParams}`);
      
      logger.info('Order test successful', {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type
      });

      return response.data;
    } catch (error) {
      logger.error('Order test failed', { orderRequest, error: error as any });
      
      if (error.response?.data?.msg) {
        throw new Error(`Binance API Error: ${error.response.data.msg}`);
      }
      
      throw new Error('Order test failed');
    }
  }
}