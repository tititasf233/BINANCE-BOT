import express from 'express';
import { Server } from 'http';
import crypto from 'crypto';

export interface MockOrderResponse {
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
}

export interface MockAccountInfo {
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
}

export class BinanceMockServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;
  private orders: Map<number, MockOrderResponse> = new Map();
  private nextOrderId = 1000000;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // Mock signature validation middleware
    this.app.use((req, res, next) => {
      const signature = req.query.signature as string;
      const timestamp = req.query.timestamp as string;
      
      if (!signature || !timestamp) {
        return res.status(400).json({
          code: -1022,
          msg: 'Signature for this request is not valid.',
        });
      }
      
      // Mock signature validation (always pass for test)
      next();
    });
  }

  private setupRoutes(): void {
    // Test connectivity
    this.app.get('/api/v3/ping', (req, res) => {
      res.json({});
    });

    // Server time
    this.app.get('/api/v3/time', (req, res) => {
      res.json({
        serverTime: Date.now(),
      });
    });

    // Account information
    this.app.get('/api/v3/account', (req, res) => {
      const mockAccount: MockAccountInfo = {
        makerCommission: 15,
        takerCommission: 15,
        buyerCommission: 0,
        sellerCommission: 0,
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: Date.now(),
        accountType: 'SPOT',
        balances: [
          { asset: 'BTC', free: '1.00000000', locked: '0.00000000' },
          { asset: 'USDT', free: '10000.00000000', locked: '0.00000000' },
          { asset: 'ETH', free: '5.00000000', locked: '0.00000000' },
        ],
      };
      res.json(mockAccount);
    });

    // Symbol price ticker
    this.app.get('/api/v3/ticker/price', (req, res) => {
      const symbol = req.query.symbol as string;
      
      const mockPrices: Record<string, string> = {
        BTCUSDT: '45000.00',
        ETHUSDT: '3000.00',
        ADAUSDT: '0.50',
      };

      if (symbol && mockPrices[symbol]) {
        res.json({
          symbol,
          price: mockPrices[symbol],
        });
      } else {
        res.json(
          Object.entries(mockPrices).map(([symbol, price]) => ({
            symbol,
            price,
          }))
        );
      }
    });

    // Place new order
    this.app.post('/api/v3/order', (req, res) => {
      const {
        symbol,
        side,
        type,
        quantity,
        price,
        timeInForce = 'GTC',
        newClientOrderId,
      } = req.body;

      const orderId = this.nextOrderId++;
      const mockOrder: MockOrderResponse = {
        symbol,
        orderId,
        orderListId: -1,
        clientOrderId: newClientOrderId || `test_${orderId}`,
        transactTime: Date.now(),
        price: price || '0.00000000',
        origQty: quantity,
        executedQty: quantity, // Assume immediate execution for tests
        cummulativeQuoteQty: (parseFloat(quantity) * parseFloat(price || '0')).toString(),
        status: 'FILLED',
        timeInForce,
        type,
        side,
      };

      this.orders.set(orderId, mockOrder);
      res.json(mockOrder);
    });

    // Place OCO order
    this.app.post('/api/v3/order/oco', (req, res) => {
      const {
        symbol,
        side,
        quantity,
        price,
        stopPrice,
        stopLimitPrice,
        stopLimitTimeInForce = 'GTC',
        listClientOrderId,
      } = req.body;

      const orderListId = this.nextOrderId++;
      const limitOrderId = this.nextOrderId++;
      const stopOrderId = this.nextOrderId++;

      const mockOcoResponse = {
        orderListId,
        contingencyType: 'OCO',
        listStatusType: 'EXEC_STARTED',
        listOrderStatus: 'EXECUTING',
        listClientOrderId: listClientOrderId || `oco_${orderListId}`,
        transactionTime: Date.now(),
        symbol,
        orders: [
          {
            symbol,
            orderId: limitOrderId,
            clientOrderId: `limit_${limitOrderId}`,
          },
          {
            symbol,
            orderId: stopOrderId,
            clientOrderId: `stop_${stopOrderId}`,
          },
        ],
        orderReports: [
          {
            symbol,
            orderId: limitOrderId,
            orderListId,
            clientOrderId: `limit_${limitOrderId}`,
            transactTime: Date.now(),
            price,
            origQty: quantity,
            executedQty: '0.00000000',
            cummulativeQuoteQty: '0.00000000',
            status: 'NEW',
            timeInForce: 'GTC',
            type: 'LIMIT_MAKER',
            side,
            stopPrice: '0.00000000',
          },
          {
            symbol,
            orderId: stopOrderId,
            orderListId,
            clientOrderId: `stop_${stopOrderId}`,
            transactTime: Date.now(),
            price: '0.00000000',
            origQty: quantity,
            executedQty: '0.00000000',
            cummulativeQuoteQty: '0.00000000',
            status: 'NEW',
            timeInForce: stopLimitTimeInForce,
            type: 'STOP_LOSS_LIMIT',
            side,
            stopPrice,
          },
        ],
      };

      res.json(mockOcoResponse);
    });

    // Get order status
    this.app.get('/api/v3/order', (req, res) => {
      const orderId = parseInt(req.query.orderId as string);
      const order = this.orders.get(orderId);

      if (order) {
        res.json(order);
      } else {
        res.status(400).json({
          code: -2013,
          msg: 'Order does not exist.',
        });
      }
    });

    // Cancel order
    this.app.delete('/api/v3/order', (req, res) => {
      const orderId = parseInt(req.query.orderId as string);
      const order = this.orders.get(orderId);

      if (order) {
        const cancelledOrder = {
          ...order,
          status: 'CANCELED',
        };
        this.orders.set(orderId, cancelledOrder);
        res.json(cancelledOrder);
      } else {
        res.status(400).json({
          code: -2013,
          msg: 'Order does not exist.',
        });
      }
    });

    // Get all open orders
    this.app.get('/api/v3/openOrders', (req, res) => {
      const openOrders = Array.from(this.orders.values()).filter(
        order => order.status === 'NEW' || order.status === 'PARTIALLY_FILLED'
      );
      res.json(openOrders);
    });

    // Historical klines
    this.app.get('/api/v3/klines', (req, res) => {
      const { symbol, interval, startTime, endTime, limit = 500 } = req.query;
      
      // Generate mock kline data
      const mockKlines = [];
      const start = startTime ? parseInt(startTime as string) : Date.now() - 24 * 60 * 60 * 1000;
      const end = endTime ? parseInt(endTime as string) : Date.now();
      const intervalMs = this.getIntervalMs(interval as string);
      
      for (let time = start; time < end && mockKlines.length < parseInt(limit as string); time += intervalMs) {
        const basePrice = 45000 + Math.sin(time / 1000000) * 1000;
        const open = basePrice + (Math.random() - 0.5) * 100;
        const close = open + (Math.random() - 0.5) * 200;
        const high = Math.max(open, close) + Math.random() * 50;
        const low = Math.min(open, close) - Math.random() * 50;
        const volume = Math.random() * 100;
        
        mockKlines.push([
          time,                           // Open time
          open.toFixed(2),               // Open
          high.toFixed(2),               // High
          low.toFixed(2),                // Low
          close.toFixed(2),              // Close
          volume.toFixed(8),             // Volume
          time + intervalMs - 1,         // Close time
          (volume * close).toFixed(8),   // Quote asset volume
          Math.floor(Math.random() * 100), // Number of trades
          (volume * 0.6).toFixed(8),     // Taker buy base asset volume
          ((volume * 0.6) * close).toFixed(8), // Taker buy quote asset volume
          '0'                            // Ignore
        ]);
      }
      
      res.json(mockKlines);
    });
  }

  private getIntervalMs(interval: string): number {
    const intervals: Record<string, number> = {
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
    };
    return intervals[interval] || 60 * 1000;
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Binance Mock Server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Binance Mock Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Helper methods for tests
  clearOrders(): void {
    this.orders.clear();
    this.nextOrderId = 1000000;
  }

  getOrder(orderId: number): MockOrderResponse | undefined {
    return this.orders.get(orderId);
  }

  getAllOrders(): MockOrderResponse[] {
    return Array.from(this.orders.values());
  }
}