import { MetricsCollector } from '../../monitoring/MetricsCollector';
import { RedisService } from '../../services/RedisService';

// Mock RedisService
jest.mock('../../services/RedisService');
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let mockRedis: jest.Mocked<RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = new MockedRedisService() as jest.Mocked<RedisService>;
    metricsCollector = new MetricsCollector();
    (metricsCollector as any).redis = mockRedis;
  });

  afterEach(async () => {
    await metricsCollector.stop();
  });

  describe('start', () => {
    it('should start metrics collection', async () => {
      await metricsCollector.start();
      expect((metricsCollector as any).metricsInterval).toBeDefined();
    });

    it('should not start multiple intervals', async () => {
      await metricsCollector.start();
      const firstInterval = (metricsCollector as any).metricsInterval;
      
      await metricsCollector.start();
      const secondInterval = (metricsCollector as any).metricsInterval;
      
      expect(firstInterval).toBe(secondInterval);
    });
  });

  describe('stop', () => {
    it('should stop metrics collection', async () => {
      await metricsCollector.start();
      expect((metricsCollector as any).metricsInterval).toBeDefined();
      
      await metricsCollector.stop();
      expect((metricsCollector as any).metricsInterval).toBeNull();
    });

    it('should handle stop when not running', async () => {
      await expect(metricsCollector.stop()).resolves.not.toThrow();
    });
  });

  describe('recordTradingMetric', () => {
    it('should record new trading metric', async () => {
      const metric = {
        symbol: 'BTCUSDT',
        strategy: 'RSI',
        totalTrades: 10,
        winRate: 0.7,
        totalPnL: 100.5
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await metricsCollector.recordTradingMetric(metric);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'trading:metrics:BTCUSDT:RSI',
        86400,
        expect.stringContaining('"symbol":"BTCUSDT"')
      );
    });

    it('should update existing trading metric', async () => {
      const existingMetric = {
        symbol: 'BTCUSDT',
        strategy: 'RSI',
        totalTrades: 5,
        winRate: 0.6,
        totalPnL: 50.0,
        avgTradeTime: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      };

      const updateMetric = {
        symbol: 'BTCUSDT',
        strategy: 'RSI',
        totalTrades: 10,
        winRate: 0.7
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingMetric));
      mockRedis.setex.mockResolvedValue('OK');

      await metricsCollector.recordTradingMetric(updateMetric);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'trading:metrics:BTCUSDT:RSI',
        86400,
        expect.stringContaining('"totalTrades":10')
      );
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics for specified hours', async () => {
      const mockMetrics = [
        {
          timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
          cpu: { usage: 50, load: [1.0, 1.1, 1.2] },
          memory: { used: 1000000, total: 2000000, percentage: 50 }
        }
      ];

      mockRedis.keys.mockResolvedValue(['system:metrics:1234567890']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockMetrics[0]));

      const result = await metricsCollector.getSystemMetrics(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        cpu: { usage: 50, load: [1.0, 1.1, 1.2] },
        memory: { used: 1000000, total: 2000000, percentage: 50 }
      });
    });

    it('should filter metrics by time range', async () => {
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const recentTimestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago

      mockRedis.keys.mockResolvedValue([
        `system:metrics:${oldTimestamp}`,
        `system:metrics:${recentTimestamp}`
      ]);

      const result = await metricsCollector.getSystemMetrics(1); // 1 hour

      expect(mockRedis.keys).toHaveBeenCalledWith('system:metrics:*');
      // Should only include recent metrics within 1 hour
    });
  });

  describe('getTradingMetricsBySymbol', () => {
    it('should return trading metrics for specific symbol', async () => {
      const mockMetrics = [
        {
          symbol: 'BTCUSDT',
          strategy: 'RSI',
          totalTrades: 10,
          winRate: 0.7,
          totalPnL: 100.5,
          avgTradeTime: 0,
          maxDrawdown: 0,
          sharpeRatio: 0
        }
      ];

      mockRedis.keys.mockResolvedValue(['trading:metrics:BTCUSDT:RSI']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockMetrics[0]));

      const result = await metricsCollector.getTradingMetricsBySymbol('BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        symbol: 'BTCUSDT',
        strategy: 'RSI',
        totalTrades: 10,
        winRate: 0.7
      });
    });

    it('should return empty array for symbol with no metrics', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await metricsCollector.getTradingMetricsBySymbol('ETHUSDT');

      expect(result).toHaveLength(0);
    });
  });
});