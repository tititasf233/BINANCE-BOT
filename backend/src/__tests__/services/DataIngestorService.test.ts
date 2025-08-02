import { DataIngestorService } from '../../services/DataIngestorService';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');
const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('DataIngestorService', () => {
  let dataIngestor: DataIngestorService;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock WebSocket instance
    mockWs = {
      readyState: WebSocket.OPEN,
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    MockWebSocket.mockImplementation(() => mockWs);
    
    dataIngestor = new DataIngestorService(false);
  });

  afterEach(async () => {
    await dataIngestor.disconnect();
  });

  describe('connection', () => {
    it('should connect to WebSocket successfully', async () => {
      // Mock successful connection
      mockWs.once.mockImplementation((event, callback) => {
        if (event === 'open') {
          setTimeout(() => callback(), 0);
        }
        return mockWs;
      });

      await dataIngestor.connect();

      expect(MockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://stream.binance.com')
      );
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connection timeout', async () => {
      // Mock connection timeout
      mockWs.once.mockImplementation((event, callback) => {
        // Don't call callback to simulate timeout
        return mockWs;
      });

      await expect(dataIngestor.connect()).rejects.toThrow('Connection timeout');
    });

    it('should handle connection error', async () => {
      const connectionError = new Error('Connection failed');
      
      mockWs.once.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(connectionError), 0);
        }
        return mockWs;
      });

      await expect(dataIngestor.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('subscriptions', () => {
    beforeEach(async () => {
      // Mock successful connection
      mockWs.once.mockImplementation((event, callback) => {
        if (event === 'open') {
          setTimeout(() => callback(), 0);
        }
        return mockWs;
      });

      await dataIngestor.connect();
    });

    it('should subscribe to kline stream', async () => {
      await dataIngestor.subscribeToKline('BTCUSDT', '1h');

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: ['btcusdt@kline_1h'],
          id: expect.any(Number)
        })
      );

      const subscriptions = dataIngestor.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]).toEqual({
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'kline'
      });
    });

    it('should subscribe to ticker stream', async () => {
      await dataIngestor.subscribeToTicker('BTCUSDT');

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: ['btcusdt@ticker'],
          id: expect.any(Number)
        })
      );

      const subscriptions = dataIngestor.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]).toEqual({
        symbol: 'BTCUSDT',
        type: 'ticker'
      });
    });

    it('should unsubscribe from stream', async () => {
      await dataIngestor.subscribeToKline('BTCUSDT', '1h');
      await dataIngestor.unsubscribe('BTCUSDT', '1h');

      expect(mockWs.send).toHaveBeenLastCalledWith(
        JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: ['btcusdt@kline_1h'],
          id: expect.any(Number)
        })
      );

      const subscriptions = dataIngestor.getSubscriptions();
      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('message processing', () => {
    beforeEach(async () => {
      // Mock successful connection
      mockWs.once.mockImplementation((event, callback) => {
        if (event === 'open') {
          setTimeout(() => callback(), 0);
        }
        return mockWs;
      });

      await dataIngestor.connect();
    });

    it('should process kline message and emit event', (done) => {
      const klineMessage = {
        stream: 'btcusdt@kline_1h',
        data: {
          k: {
            s: 'BTCUSDT',
            i: '1h',
            t: 1640995200000,
            T: 1640998799999,
            o: '50000.00',
            h: '51000.00',
            l: '49000.00',
            c: '50500.00',
            v: '100.5',
            n: 1000,
            x: true // Kline is closed
          }
        }
      };

      dataIngestor.on('kline_closed', (klineData) => {
        expect(klineData).toEqual({
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: 1640995200000,
          closeTime: 1640998799999,
          open: '50000.00',
          high: '51000.00',
          low: '49000.00',
          close: '50500.00',
          volume: '100.5',
          trades: 1000,
          isFinal: true
        });
        done();
      });

      // Simulate receiving message
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler(JSON.stringify(klineMessage));
      }
    });

    it('should process ticker message and emit event', (done) => {
      const tickerMessage = {
        stream: 'btcusdt@ticker',
        data: {
          s: 'BTCUSDT',
          c: '50000.00',
          P: '1000.00',
          p: '2.00',
          v: '1000000.00',
          E: 1640995200000
        }
      };

      dataIngestor.on('ticker_update', (tickerData) => {
        expect(tickerData).toEqual({
          symbol: 'BTCUSDT',
          price: '50000.00',
          priceChange: '2.00',
          priceChangePercent: '1000.00',
          volume: '1000000.00',
          timestamp: 1640995200000
        });
        done();
      });

      // Simulate receiving message
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler(JSON.stringify(tickerMessage));
      }
    });

    it('should not emit event for non-final kline', () => {
      const klineMessage = {
        stream: 'btcusdt@kline_1h',
        data: {
          k: {
            s: 'BTCUSDT',
            i: '1h',
            t: 1640995200000,
            T: 1640998799999,
            o: '50000.00',
            h: '51000.00',
            l: '49000.00',
            c: '50500.00',
            v: '100.5',
            n: 1000,
            x: false // Kline is not closed
          }
        }
      };

      const klineHandler = jest.fn();
      dataIngestor.on('kline_closed', klineHandler);

      // Simulate receiving message
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler(JSON.stringify(klineMessage));
      }

      expect(klineHandler).not.toHaveBeenCalled();
    });
  });

  describe('connection status', () => {
    it('should return correct connection status', () => {
      const status = dataIngestor.getConnectionStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('reconnectAttempts');
      expect(status).toHaveProperty('subscriptions');
      expect(typeof status.connected).toBe('boolean');
      expect(typeof status.reconnectAttempts).toBe('number');
      expect(typeof status.subscriptions).toBe('number');
    });
  });
});