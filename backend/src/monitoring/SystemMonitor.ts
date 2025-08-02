import logger from '../utils/logger';
// Performance monitor import removed as it's not used
import { EventEmitter } from 'events';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
  metadata?: Record<string, any>;
}

interface SystemStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheck[];
  uptime: number;
  timestamp: Date;
}

type HealthCheckFunction = () => Promise<Omit<HealthCheck, 'name' | 'lastCheck'>>;

class SystemMonitor extends EventEmitter {
  private healthChecks: Map<string, HealthCheckFunction> = new Map();
  private lastHealthStatus: Map<string, HealthCheck> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private checkIntervalMs: number = 30000; // 30 seconds

  constructor() {
    super();
    this.setupDefaultHealthChecks();
  }

  // Register a health check
  registerHealthCheck(name: string, checkFunction: HealthCheckFunction): void {
    this.healthChecks.set(name, checkFunction);
    logger.info(`Health check registered: ${name}`);
  }

  // Remove a health check
  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.lastHealthStatus.delete(name);
    logger.info(`Health check unregistered: ${name}`);
  }

  // Perform a single health check
  async performHealthCheck(name: string): Promise<HealthCheck> {
    const checkFunction = this.healthChecks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();
    
    try {
      const result = await checkFunction();
      const responseTime = Date.now() - startTime;
      
      const healthCheck: HealthCheck = {
        name,
        ...result,
        lastCheck: new Date(),
        responseTime
      };

      this.lastHealthStatus.set(name, healthCheck);
      
      logger.debug(`Health check completed: ${name}`, {
        status: result.status,
        responseTime,
        type: 'HEALTH_CHECK'
      });

      return healthCheck;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
        responseTime
      };

      this.lastHealthStatus.set(name, healthCheck);
      
      logger.error(`Health check failed: ${name}`, {
        error: error instanceof Error ? error.message : error,
        responseTime,
        type: 'HEALTH_CHECK_FAILED'
      });

      return healthCheck;
    }
  }

  // Perform all health checks
  async performAllHealthChecks(): Promise<HealthCheck[]> {
    const checks = Array.from(this.healthChecks.keys());
    const results = await Promise.allSettled(
      checks.map(name => this.performHealthCheck(name))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: checks[index],
          status: 'unhealthy' as const,
          message: 'Health check execution failed',
          lastCheck: new Date()
        };
      }
    });
  }

  // Get current system status
  async getSystemStatus(): Promise<SystemStatus> {
    const services = await this.performAllHealthChecks();
    
    // Determine overall status
    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    const status: SystemStatus = {
      overall,
      services,
      uptime: process.uptime(),
      timestamp: new Date()
    };

    this.emit('statusUpdate', status);
    return status;
  }

  // Get last known status without performing new checks
  getLastKnownStatus(): SystemStatus {
    const services = Array.from(this.lastHealthStatus.values());
    
    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      services,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  // Start continuous monitoring
  start(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('System monitoring is already running');
      return;
    }

    this.checkIntervalMs = intervalMs;
    this.isMonitoring = true;

    // Perform initial health check
    this.performAllHealthChecks().catch(error => {
      logger.error('Initial health check failed', { error });
    });

    // Setup periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        
        // Log status changes
        if (status.overall !== 'healthy') {
          logger.warn('System status is not healthy', {
            overall: status.overall,
            unhealthyServices: status.services.filter(s => s.status !== 'healthy').map(s => s.name),
            type: 'SYSTEM_STATUS_CHANGE'
          });
        }
        
      } catch (error) {
        logger.error('System monitoring check failed', { error });
      }
    }, intervalMs);

    logger.info('System monitoring started', { intervalMs });
    this.emit('started');
  }

  // Stop monitoring
  stop(): void {
    if (!this.isMonitoring) {
      logger.warn('System monitoring is not running');
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    logger.info('System monitoring stopped');
    this.emit('stopped');
  }

  // Check if monitoring is running
  isRunning(): boolean {
    return this.isMonitoring;
  }

  // Setup default health checks
  private setupDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      try {
        // This would be replaced with actual database connection check
        // For now, we'll simulate a basic check
        const startTime = Date.now();
        
        // Simulate database query
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const responseTime = Date.now() - startTime;
        
        if (responseTime > 1000) {
          return {
            status: 'degraded',
            message: 'Database response time is high',
            metadata: { responseTime }
          };
        }
        
        return {
          status: 'healthy',
          message: 'Database connection is healthy'
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Database connection failed: ${error instanceof Error ? error.message : error}`
        };
      }
    });

    // Redis health check
    this.registerHealthCheck('redis', async () => {
      try {
        // This would be replaced with actual Redis connection check
        const startTime = Date.now();
        
        // Simulate Redis ping
        await new Promise(resolve => setTimeout(resolve, 5));
        
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          message: 'Redis connection is healthy',
          metadata: { responseTime }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Redis connection failed: ${error instanceof Error ? error.message : error}`
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      if (heapUsagePercent > 90) {
        return {
          status: 'unhealthy',
          message: 'Memory usage is critically high',
          metadata: { heapUsagePercent, heapUsedMB, heapTotalMB }
        };
      } else if (heapUsagePercent > 75) {
        return {
          status: 'degraded',
          message: 'Memory usage is high',
          metadata: { heapUsagePercent, heapUsedMB, heapTotalMB }
        };
      }

      return {
        status: 'healthy',
        message: 'Memory usage is normal',
        metadata: { heapUsagePercent, heapUsedMB, heapTotalMB }
      };
    });

    // Event loop health check
    this.registerHealthCheck('eventloop', async () => {
      const delay = await this.measureEventLoopDelay();
      
      if (delay > 100) {
        return {
          status: 'unhealthy',
          message: 'Event loop delay is critically high',
          metadata: { delay }
        };
      } else if (delay > 50) {
        return {
          status: 'degraded',
          message: 'Event loop delay is high',
          metadata: { delay }
        };
      }

      return {
        status: 'healthy',
        message: 'Event loop is responsive',
        metadata: { delay }
      };
    });
  }

  // Measure event loop delay
  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(delay);
      });
    });
  }
}

// Singleton instance
const systemMonitor = new SystemMonitor();

export default systemMonitor;
export { SystemMonitor, HealthCheck, SystemStatus };