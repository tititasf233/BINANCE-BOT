import { HealthChecker } from '../../monitoring/HealthChecker';
import { RedisService } from '../../services/RedisService';
import { DatabaseConnection } from '../../database/connection';
import { BinanceApiService } from '../../services/BinanceApiService';

// Mock dependencies
jest.mock('../../services/RedisService');
jest.mock('../../database/connection');
jest.mock('../../services/BinanceApiService');

const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;
const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedBinanceApiService = BinanceApiService as jest.MockedClass<typeof BinanceApiService>;

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;
  let mockRedis: jest.Mocked<RedisService>;
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockBinanceApi: jest.Mocked<BinanceApiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = new MockedRedisService() as jest.Mocked<RedisService>;
    mockDb = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockBinanceApi = new MockedBinanceApiService() as jest.Mocked<BinanceApiService>;
    
    healthChecker = new HealthChecker();
    (healthChecker as any).redis = mockRedis;
    (healthChecker as any).db = mockDb;
    (healthChecker as any).binanceApi = mockBinanceApi;
  });

  afterEach(async () => {
    await healthChecker.stop();
  });

  describe('start', () => {
    it('should start health checks', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      
      await healthChecker.start();
      
      expect((healthChecker as any).healthCheckInterval).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop health checks', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      
      await healthChecker.start();
      await healthChecker.stop();
      
      expect((healthChecker as any).healthCheckInterval).toBeNull();
    });
  });

  describe('performHealthCheck', () => {
    beforeEach(() => {
      mockRedis.setex.mockResolvedValue('OK');
    });

    it('should return healthy status when all services are healthy', async () => {
      // Mock all services as healthy
      mockDb.query.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBinanceApi.getServerTime.mockResolvedValue(Date.now());

      const result = await healthChecker.performHealthCheck();

      expect(result.overall).toBe('healthy');
      expect(result.services).toHaveLength(5); // database, redis, binance_api, memory, disk_space
      expect(result.services.every(s => s.status === 'healthy')).toBe(true);
    });

    it('should return unhealthy status when database fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection failed'));
      mockRedis.ping.mockResolvedValue('PONG');
      mockBinanceApi.getServerTime.mockResolvedValue(Date.now());

      const result = await healthChecker.performHealthCheck();

      expect(result.overall).toBe('unhealthy');
      const dbService = result.services.find(s => s.service === 'database');
      expect(dbService?.status).toBe('unhealthy');
      expect(dbService?.error).toBe('Connection failed');
    });

    it('should return degraded status when response times are slow', async () => {
      // Mock slow database response
      mockDb.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 1500))
      );
      mockRedis.ping.mockResolvedValue('PONG');
      mockBinanceApi.getServerTime.mockResolvedValue(Date.now());

      const result = await healthChecker.performHealthCheck();

      const dbService = result.services.find(s => s.service === 'database');
      expect(dbService?.status).toBe('degraded');
      expect(dbService?.responseTime).toBeGreaterThan(1000);
    });

    it('should return unhealthy status when Redis fails', async () => {
      mockDb.query.mockResolvedValue([]);
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
      mockBinanceApi.getServerTime.mockResolvedValue(Date.now());

      const result = await healthChecker.performHealthCheck();

      expect(result.overall).toBe('unhealthy');
      const redisService = result.services.find(s => s.service === 'redis');
      expect(redisService?.status).toBe('unhealthy');
      expect(redisService?.error).toBe('Redis connection failed');
    });

    it('should return unhealthy status when Binance API fails', async () => {
      mockDb.query.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockBinanceApi.getServerTime.mockRejectedValue(new Error('API error'));

      const result = await healthChecker.performHealthCheck();

      expect(result.overall).toBe('unhealthy');
      const binanceService = result.services.find(s => s.service === 'binance_api');
      expect(binanceService?.status).toBe('unhealthy');
      expect(binanceService?.error).toBe('API error');
    });

    it('should return degraded status when Binance time difference is high', async () => {
      mockDb.query.mockResolvedValue([]);
      mockRedis.ping.mockResolvedValue('PONG');
      // Mock server time with 10 second difference
      mockBinanceApi.getServerTime.mockResolvedValue(Date.now() - 10000);

      const result = await healthChecker.performHealthCheck();

      const binanceService = result.services.find(s => s.service === 'binance_api');
      expect(binanceService?.status).toBe('degraded');
      expect(binanceService?.details?.timeDifference).toBeGreaterThan(5000);
    });
  });

  describe('getHealthStatus', () => {
    it('should return cached health status', async () => {
      const mockHealth = {
        overall: 'healthy' as const,
        timestamp: Date.now(),
        services: []
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockHealth));

      const result = await healthChecker.getHealthStatus();

      expect(result).toEqual(mockHealth);
      expect(mockRedis.get).toHaveBeenCalledWith('system:health');
    });

    it('should return null when no cached data exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await healthChecker.getHealthStatus();

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await healthChecker.getHealthStatus();

      expect(result).toBeNull();
    });
  });

  describe('getServiceHealth', () => {
    it('should return specific service health', async () => {
      const mockHealth = {
        overall: 'healthy' as const,
        timestamp: Date.now(),
        services: [
          {
            service: 'database',
            status: 'healthy' as const,
            timestamp: Date.now(),
            responseTime: 100
          },
          {
            service: 'redis',
            status: 'degraded' as const,
            timestamp: Date.now(),
            responseTime: 600
          }
        ]
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockHealth));

      const result = await healthChecker.getServiceHealth('database');

      expect(result).toEqual(mockHealth.services[0]);
    });

    it('should return null for non-existent service', async () => {
      const mockHealth = {
        overall: 'healthy' as const,
        timestamp: Date.now(),
        services: []
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockHealth));

      const result = await healthChecker.getServiceHealth('nonexistent');

      expect(result).toBeNull();
    });
  });
});