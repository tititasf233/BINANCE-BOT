import { RedisService } from '../services/RedisService';
import { DatabaseConnection } from '../database/connection';
import { BinanceApiService } from '../services/BinanceApiService';
import { logger } from '../utils/logger';

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  responseTime: number;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  services: HealthStatus[];
}

export class HealthChecker {
  private redis: RedisService;
  private db: DatabaseConnection;
  private binanceApi: BinanceApiService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_KEY = 'system:health';

  constructor() {
    this.redis = new RedisService();
    this.db = new DatabaseConnection();
    this.binanceApi = new BinanceApiService();
  }

  public async start(): Promise<void> {
    logger.info('Starting health checks');
    
    // Run health checks every 60 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Error performing health check', { error });
      }
    }, 60000);

    // Run initial health check
    await this.performHealthCheck();
  }

  public async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    logger.info('Stopped health checks');
  }

  public async performHealthCheck(): Promise<SystemHealth> {
    const timestamp = Date.now();
    const services: HealthStatus[] = [];

    // Check all services
    services.push(await this.checkDatabase());
    services.push(await this.checkRedis());
    services.push(await this.checkBinanceApi());
    services.push(await this.checkMemoryUsage());
    services.push(await this.checkDiskSpace());

    // Determine overall health
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');

    let overall: SystemHealth['overall'];
    if (unhealthyServices.length > 0) {
      overall = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const systemHealth: SystemHealth = {
      overall,
      timestamp,
      services
    };

    // Store health status in Redis
    await this.redis.setex(
      this.HEALTH_KEY,
      300, // 5 minutes TTL
      JSON.stringify(systemHealth)
    );

    // Log health status changes
    if (overall !== 'healthy') {
      logger.warn('System health degraded', { systemHealth });
    }

    return systemHealth;
  }

  private async checkDatabase(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Simple query to check database connectivity
      await this.db.query('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        responseTime,
        details: {
          query: 'SELECT 1',
          connectionPool: 'active'
        }
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedis(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test Redis connectivity with ping
      const result = await this.redis.ping();
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'redis',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        responseTime,
        details: {
          ping: result,
          connected: true
        }
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkBinanceApi(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test Binance API connectivity
      const serverTime = await this.binanceApi.getServerTime();
      
      const responseTime = Date.now() - startTime;
      const timeDiff = Math.abs(Date.now() - serverTime);
      
      // Check if time difference is acceptable (less than 5 seconds)
      const status = timeDiff < 5000 && responseTime < 2000 ? 'healthy' : 'degraded';
      
      return {
        service: 'binance_api',
        status,
        timestamp: Date.now(),
        responseTime,
        details: {
          serverTime,
          timeDifference: timeDiff,
          acceptable: timeDiff < 5000
        }
      };
    } catch (error) {
      return {
        service: 'binance_api',
        status: 'unhealthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const os = await import('os');
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      
      let status: HealthStatus['status'];
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > 80) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        service: 'memory',
        status,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        details: {
          totalMemory,
          freeMemory,
          usedMemory,
          usagePercent: memoryUsagePercent
        }
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkDiskSpace(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs');
      const { promisify } = await import('util');
      const stat = promisify(fs.stat);
      
      // Check current directory disk space
      const stats = await stat('.');
      
      // This is a simplified check - in production you'd want to check actual disk usage
      const status = 'healthy'; // Placeholder
      
      return {
        service: 'disk_space',
        status,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        details: {
          path: process.cwd(),
          available: true
        }
      };
    } catch (error) {
      return {
        service: 'disk_space',
        status: 'unhealthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async getHealthStatus(): Promise<SystemHealth | null> {
    try {
      const data = await this.redis.get(this.HEALTH_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error retrieving health status', { error });
      return null;
    }
  }

  public async getServiceHealth(serviceName: string): Promise<HealthStatus | null> {
    const systemHealth = await this.getHealthStatus();
    if (!systemHealth) return null;
    
    return systemHealth.services.find(s => s.service === serviceName) || null;
  }
}