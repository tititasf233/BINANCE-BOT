import { StrategyEngineService } from '../../services/StrategyEngineService';
import { strategyModel } from '../../database/models/Strategy';
import { messageBroker } from '../../services/MessageBrokerService';
import { RSIStrategy } from '../../trading/strategies/RSIStrategy';

// Mock dependencies
jest.mock('../../database/models/Strategy');
jest.mock('../../services/MessageBrokerService');
jest.mock('../../trading/strategies/RSIStrategy');

const mockStrategyModel = strategyModel as jest.Mocked<typeof strategyModel>;
const mockMessageBroker = messageBroker as jest.Mocked<typeof messageBroker>;
const MockRSIStrategy = RSIStrategy as jest.MockedClass<typeof RSIStrategy>;

describe('StrategyEngineService', () => {
  let strategyEngine: StrategyEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    strategyEngine = new StrategyEngineService();
  });

  afterEach(async () => {
    await strategyEngine.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      mockStrategyModel.findAllActive.mockResolvedValue([]);

      await strategyEngine.initialize();

      expect(mockMessageBroker.initialize).toHaveBeenCalled();
      expect(mockMessageBroker.subscribe).toHaveBeenCalledWith(
        'market.kline.closed',
        expect.any(Function)
      );
      expect(mockStrategyModel.findAllActive).toHaveBeenCalled();
    });

    it('should load active strategies on initialization', async () => {
      const mockStrategy = {
        id: 1,
        user_id: 1,
        name: 'Test RSI Strategy',
        symbol: 'BTCUSDT',
        interval: '1h',
        entry_conditions: [],
        exit_conditions: [],
        risk_params: { indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } } },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      mockStrategyModel.findAllActive.mockResolvedValue([mockStrategy]);
      mockStrategyModel.toStrategyParams.mockReturnValue({
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
        indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } }
      });

      const mockStrategyInstance = {
        activate: jest.fn(),
        on: jest.fn(),
        getParams: jest.fn().mockReturnValue({ symbol: 'BTCUSDT', interval: '1h' })
      };
      MockRSIStrategy.mockImplementation(() => mockStrategyInstance as any);

      await strategyEngine.initialize();

      expect(mockStrategyModel.findAllActive).toHaveBeenCalled();
      expect(MockRSIStrategy).toHaveBeenCalled();
      expect(mockStrategyInstance.activate).toHaveBeenCalled();
    });
  });

  describe('strategy management', () => {
    beforeEach(async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      mockStrategyModel.findAllActive.mockResolvedValue([]);
      await strategyEngine.initialize();
    });

    it('should start a strategy successfully', async () => {
      const mockStrategy = {
        id: 1,
        user_id: 1,
        name: 'Test RSI Strategy',
        symbol: 'BTCUSDT',
        interval: '1h',
        entry_conditions: [],
        exit_conditions: [],
        risk_params: { indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } } },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockStrategyModel.toStrategyParams.mockReturnValue({
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
        indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } }
      });

      const mockStrategyInstance = {
        activate: jest.fn(),
        on: jest.fn(),
        getParams: jest.fn().mockReturnValue({ symbol: 'BTCUSDT', interval: '1h' }),
        getState: jest.fn().mockReturnValue({ isActive: true })
      };
      MockRSIStrategy.mockImplementation(() => mockStrategyInstance as any);

      await strategyEngine.startStrategy(mockStrategy);

      expect(MockRSIStrategy).toHaveBeenCalled();
      expect(mockStrategyInstance.activate).toHaveBeenCalled();
      expect(strategyEngine.getStrategy(1)).toBeDefined();
    });

    it('should stop a strategy successfully', async () => {
      // First start a strategy
      const mockStrategy = {
        id: 1,
        user_id: 1,
        name: 'Test RSI Strategy',
        symbol: 'BTCUSDT',
        interval: '1h',
        entry_conditions: [],
        exit_conditions: [],
        risk_params: { indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } } },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockStrategyModel.toStrategyParams.mockReturnValue({
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
        indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } }
      });

      const mockStrategyInstance = {
        activate: jest.fn(),
        deactivate: jest.fn(),
        on: jest.fn(),
        getParams: jest.fn().mockReturnValue({ symbol: 'BTCUSDT', interval: '1h' }),
        getState: jest.fn().mockReturnValue({ isActive: true })
      };
      MockRSIStrategy.mockImplementation(() => mockStrategyInstance as any);

      await strategyEngine.startStrategy(mockStrategy);
      expect(strategyEngine.getStrategy(1)).toBeDefined();

      await strategyEngine.stopStrategy(1);
      expect(mockStrategyInstance.deactivate).toHaveBeenCalled();
      expect(strategyEngine.getStrategy(1)).toBeNull();
    });

    it('should handle strategy not found for stopping', async () => {
      // Should not throw error when stopping non-existent strategy
      await expect(strategyEngine.stopStrategy(999)).resolves.not.toThrow();
    });
  });

  describe('kline data processing', () => {
    beforeEach(async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      mockStrategyModel.findAllActive.mockResolvedValue([]);
      await strategyEngine.initialize();
    });

    it('should process kline data for relevant strategies', async () => {
      // Start a strategy
      const mockStrategy = {
        id: 1,
        user_id: 1,
        name: 'Test RSI Strategy',
        symbol: 'BTCUSDT',
        interval: '1h',
        entry_conditions: [],
        exit_conditions: [],
        risk_params: { indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } } },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockStrategyModel.toStrategyParams.mockReturnValue({
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
        indicatorParams: { rsi: { period: 14, overbought: 70, oversold: 30 } }
      });

      const mockStrategyInstance = {
        activate: jest.fn(),
        on: jest.fn(),
        onKline: jest.fn(),
        getParams: jest.fn().mockReturnValue({ symbol: 'BTCUSDT', interval: '1h' }),
        getState: jest.fn().mockReturnValue({ isActive: true })
      };
      MockRSIStrategy.mockImplementation(() => mockStrategyInstance as any);

      await strategyEngine.startStrategy(mockStrategy);

      // Simulate kline data
      const klineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now(),
        closeTime: Date.now(),
        open: '50000',
        high: '51000',
        low: '49000',
        close: '50500',
        volume: '100',
        trades: 1000,
        isFinal: true
      };

      const message = {
        id: 'test-message',
        type: 'market.kline.closed',
        payload: klineData,
        timestamp: Date.now(),
        source: 'test'
      };

      // Get the handler that was registered with messageBroker.subscribe
      const subscribeCall = mockMessageBroker.subscribe.mock.calls.find(
        call => call[0] === 'market.kline.closed'
      );
      expect(subscribeCall).toBeDefined();
      
      const handler = subscribeCall![1];
      await handler(message);

      expect(mockStrategyInstance.onKline).toHaveBeenCalledWith(klineData);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      mockStrategyModel.findAllActive.mockResolvedValue([]);
      await strategyEngine.initialize();
    });

    it('should return correct statistics', () => {
      const stats = strategyEngine.getStats();

      expect(stats).toHaveProperty('totalStrategies');
      expect(stats).toHaveProperty('runningStrategies');
      expect(stats).toHaveProperty('totalSignals');
      expect(stats).toHaveProperty('signalsToday');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('errorRate');

      expect(typeof stats.totalStrategies).toBe('number');
      expect(typeof stats.runningStrategies).toBe('number');
      expect(typeof stats.totalSignals).toBe('number');
      expect(typeof stats.averageLatency).toBe('number');
      expect(typeof stats.errorRate).toBe('number');
    });
  });

  describe('health check', () => {
    it('should return unhealthy when not initialized', async () => {
      const health = await strategyEngine.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.initialized).toBe(false);
    });

    it('should return healthy when initialized', async () => {
      mockMessageBroker.initialize.mockResolvedValue();
      mockMessageBroker.subscribe.mockResolvedValue();
      mockStrategyModel.findAllActive.mockResolvedValue([]);

      await strategyEngine.initialize();
      const health = await strategyEngine.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
    });
  });
});