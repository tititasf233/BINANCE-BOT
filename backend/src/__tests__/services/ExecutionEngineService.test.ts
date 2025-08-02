import { ExecutionEngineService } from '../../services/ExecutionEngineService';
import { messageBroker } from '../../services/MessageBrokerService';
import { apiKeyService } from '../../services/ApiKeyService';
import { tradeModel } from '../../database/models/Trade';
import { BinanceTradingService } from '../../services/BinanceTradingService';

// Mock dependencies
jest.mock('../../services/MessageBrokerService');
jest.mock('../../services/ApiKeyService');
jest.mock('../../database/models/Trade');
jest.mock('../../services/BinanceTradingService');

const mockMessageBroker = messageBroker as jest.Mocked<typeof messageBroker>;
const mockApiKeyService = apiKeyService as jest.Mocked<typeof apiKeyService>;
const mockTradeModel = tradeModel as jest.Mocked<typeof tradeModel>;
const MockBinanceTradingService = BinanceTradingService as jest.MockedClass<typeof BinanceTradingService>;

describe('ExecutionEngineService', () => {
  let executionEngine: ExecutionEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    executionEngine = new ExecutionEngineService();
  });

  afterEach(async () => {
    await executionEngine.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();

      await executionEngine.initialize();

      expect(mockMessageBroker.initialize).toHaveBeenCalled();
      expect(mockMessageBroker.subscribe).toHaveBeenCalledWith(
        'trading.signal.generated',
        expect.any(Function)
      );
    });
  });

  describe('trade signal handling', () => {
    beforeEach(async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      await executionEngine.initialize();
    });

    it('should handle buy signal successfully', async () => {
      const tradeSignal = {
        strategyId: 1,
        userId: 1,
        signal: {
          signal: 'BUY' as const,
          strength: 80,
          conditions: [],
          timestamp: Date.now()
        },
        strategyParams: {
          symbol: 'BTCUSDT',
          interval: '1h',
          entryConditions: [],
          exitConditions: [],
          riskParams: {
            positionSizeUsd: 100,
            takeProfitPercent: 3,
            stopLossPercent: 2,
            maxDrawdownPercent: 10,
            maxPositions: 1
          },
          indicatorParams: {}
        }
      };

      const message = {
        id: 'test-message',
        type: 'trading.signal.generated',
        payload: tradeSignal,
        timestamp: Date.now(),
        source: 'test'
      };

      // Mock API credentials
      mockApiKeyService.getDecryptedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'test-api-key',
          secretKey: 'test-secret-key',
          isTestnet: true
        }
      });

      // Mock no existing trades
      mockTradeModel.findOpenTradesByStrategy.mockResolvedValue([]);

      // Mock Binance trading service
      const mockTradingService = {
        calculateQuantityFromUSD: jest.fn().mockResolvedValue('0.001'),
        validateOrderParams: jest.fn().mockResolvedValue({
          isValid: true,
          errors: []
        }),
        placeMarketOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          executedQty: '0.001',
          transactTime: Date.now(),
          fills: [
            {
              price: '50000.00',
              qty: '0.001',
              commission: '0.00001',
              commissionAsset: 'BTC'
            }
          ]
        }),
        placeOCOOrder: jest.fn().mockResolvedValue({
          orderListId: 67890,
          orders: []
        })
      };

      MockBinanceTradingService.mockImplementation(() => mockTradingService as any);

      // Mock trade creation
      mockTradeModel.create.mockResolvedValue({
        id: 1,
        strategy_id: 1,
        binance_order_id_entry: 12345,
        symbol: 'BTCUSDT',
        status: 'OPEN',
        side: 'BUY',
        entry_price: 50000,
        quantity: 0.001,
        entry_timestamp: new Date(),
        fees: 0.00001,
        created_at: new Date()
      });

      mockTradeModel.updateOCOOrderId.mockResolvedValue(true);

      // Get the handler that was registered with messageBroker.subscribe
      const subscribeCall = mockMessageBroker.subscribe.mock.calls.find(
        call => call[0] === 'trading.signal.generated'
      );
      expect(subscribeCall).toBeDefined();
      
      const handler = subscribeCall![1];
      await handler(message);

      expect(mockApiKeyService.getDecryptedCredentials).toHaveBeenCalledWith(1);
      expect(MockBinanceTradingService).toHaveBeenCalledWith(
        'test-api-key',
        'test-secret-key',
        true
      );
      expect(mockTradingService.placeMarketOrder).toHaveBeenCalled();
      expect(mockTradingService.placeOCOOrder).toHaveBeenCalled();
      expect(mockTradeModel.create).toHaveBeenCalled();
      expect(mockTradeModel.updateOCOOrderId).toHaveBeenCalledWith(1, 67890);
    });

    it('should handle sell signal for existing long position', async () => {
      const tradeSignal = {
        strategyId: 1,
        userId: 1,
        signal: {
          signal: 'SELL' as const,
          strength: 80,
          conditions: [],
          timestamp: Date.now()
        },
        strategyParams: {
          symbol: 'BTCUSDT',
          interval: '1h',
          entryConditions: [],
          exitConditions: [],
          riskParams: {
            positionSizeUsd: 100,
            takeProfitPercent: 3,
            stopLossPercent: 2,
            maxDrawdownPercent: 10,
            maxPositions: 1
          },
          indicatorParams: {}
        }
      };

      const message = {
        id: 'test-message',
        type: 'trading.signal.generated',
        payload: tradeSignal,
        timestamp: Date.now(),
        source: 'test'
      };

      // Mock API credentials
      mockApiKeyService.getDecryptedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'test-api-key',
          secretKey: 'test-secret-key',
          isTestnet: true
        }
      });

      // Mock existing long trade
      const existingTrade = {
        id: 1,
        strategy_id: 1,
        binance_order_id_entry: 12345,
        binance_order_id_oco: 67890,
        symbol: 'BTCUSDT',
        status: 'OPEN' as const,
        side: 'BUY' as const,
        entry_price: 50000,
        quantity: 0.001,
        entry_timestamp: new Date(),
        fees: 0.00001,
        created_at: new Date()
      };

      mockTradeModel.findOpenTradesByStrategy.mockResolvedValue([existingTrade]);

      // Mock Binance trading service
      const mockTradingService = {
        cancelOCOOrder: jest.fn().mockResolvedValue({}),
        placeMarketOrder: jest.fn().mockResolvedValue({
          orderId: 54321,
          executedQty: '0.001',
          transactTime: Date.now(),
          fills: [
            {
              price: '51000.00',
              qty: '0.001',
              commission: '0.00001',
              commissionAsset: 'BTC'
            }
          ]
        })
      };

      MockBinanceTradingService.mockImplementation(() => mockTradingService as any);

      // Mock trade closure
      mockTradeModel.closeTrade.mockResolvedValue({
        ...existingTrade,
        status: 'CLOSED_MANUAL' as const,
        exit_price: 51000,
        exit_timestamp: new Date(),
        pnl: 10 // Profit
      });

      // Get the handler and execute
      const subscribeCall = mockMessageBroker.subscribe.mock.calls.find(
        call => call[0] === 'trading.signal.generated'
      );
      const handler = subscribeCall![1];
      await handler(message);

      expect(mockTradingService.cancelOCOOrder).toHaveBeenCalledWith('BTCUSDT', 67890);
      expect(mockTradingService.placeMarketOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'MARKET',
        quantity: '0.001'
      });
      expect(mockTradeModel.closeTrade).toHaveBeenCalled();
    });

    it('should handle missing API credentials', async () => {
      const tradeSignal = {
        strategyId: 1,
        userId: 1,
        signal: {
          signal: 'BUY' as const,
          strength: 80,
          conditions: [],
          timestamp: Date.now()
        },
        strategyParams: {
          symbol: 'BTCUSDT',
          interval: '1h',
          entryConditions: [],
          exitConditions: [],
          riskParams: {
            positionSizeUsd: 100,
            takeProfitPercent: 3,
            stopLossPercent: 2,
            maxDrawdownPercent: 10,
            maxPositions: 1
          },
          indicatorParams: {}
        }
      };

      const message = {
        id: 'test-message',
        type: 'trading.signal.generated',
        payload: tradeSignal,
        timestamp: Date.now(),
        source: 'test'
      };

      // Mock no API credentials
      mockApiKeyService.getDecryptedCredentials.mockResolvedValue({
        success: false,
        error: 'No active API key found'
      });

      const executionFailedSpy = jest.fn();
      executionEngine.on('execution_failed', executionFailedSpy);

      // Get the handler and execute
      const subscribeCall = mockMessageBroker.subscribe.mock.calls.find(
        call => call[0] === 'trading.signal.generated'
      );
      const handler = subscribeCall![1];
      await handler(message);

      expect(executionFailedSpy).toHaveBeenCalledWith({
        error: 'No active API credentials found',
        signal: tradeSignal
      });
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      const stats = executionEngine.getStats();

      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('openTrades');

      expect(typeof stats.totalExecutions).toBe('number');
      expect(typeof stats.successfulExecutions).toBe('number');
      expect(typeof stats.failedExecutions).toBe('number');
      expect(typeof stats.averageLatency).toBe('number');
      expect(typeof stats.errorRate).toBe('number');
      expect(typeof stats.openTrades).toBe('number');
    });
  });

  describe('health check', () => {
    it('should return unhealthy when not initialized', async () => {
      const health = await executionEngine.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.initialized).toBe(false);
    });

    it('should return healthy when initialized', async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();

      await executionEngine.initialize();
      const health = await executionEngine.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
    });
  });

  describe('orphaned trades reconciliation', () => {
    beforeEach(async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      await executionEngine.initialize();
    });

    it('should handle orphaned trades', async () => {
      const orphanedTrade = {
        id: 1,
        strategy_id: 1,
        binance_order_id_entry: 12345,
        symbol: 'BTCUSDT',
        status: 'OPEN' as const,
        side: 'BUY' as const,
        entry_price: 50000,
        quantity: 0.001,
        entry_timestamp: new Date(),
        fees: 0.00001,
        created_at: new Date()
      };

      mockTradeModel.getOrphanedTrades.mockResolvedValue([orphanedTrade]);
      mockTradeModel.markTradeAsFailed.mockResolvedValue(true);

      // Access the private method through reflection for testing
      const reconcileMethod = (executionEngine as any).reconcileOrphanedTrades;
      await reconcileMethod.call(executionEngine);

      expect(mockTradeModel.getOrphanedTrades).toHaveBeenCalled();
      expect(mockTradeModel.markTradeAsFailed).toHaveBeenCalledWith(
        1,
        'Orphaned trade - missing OCO order'
      );
    });
  });
});