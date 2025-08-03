import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { json, urlencoded } from 'express';

// Middleware imports
import { 
  securityHeaders, 
  corsOptions, 
  sanitizeRequest, 
  preventParameterPollution,
  suspiciousRequestDetector,
  addSecurityHeaders
} from './middleware/security';
import { 
  errorHandler, 
  notFoundHandler, 
  setupGlobalErrorHandlers 
} from './middleware/errorHandler';
import { 
  sanitize, 
  validateRequestSize 
} from './middleware/validation';
import { createApiRateLimiter } from './middleware/rateLimiter';

// Gateway imports
import ApiGateway from './gateway/ApiGateway';
import RequestLogger from './gateway/RequestLogger';
// import RequestValidator from './gateway/RequestValidator'; // Not used yet

// Services
import { initializeDatabase } from './database';
import { redisService } from './services/RedisService';
import { marketDataManager } from './services/MarketDataManager';
import { strategyEngine } from './services/StrategyEngineService';
import { executionEngine } from './services/ExecutionEngineService';
import { logger } from './utils/logger';

// Monitoring services
import systemMonitor from './monitoring/SystemMonitor';
import performanceMonitor from './monitoring/PerformanceMonitor';
import alertManager from './monitoring/AlertManager';

export class App {
  public app: express.Application;
  private apiGateway: ApiGateway;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.apiGateway = new ApiGateway();
    this.setupGlobalErrorHandlers();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupGlobalErrorHandlers(): void {
    setupGlobalErrorHandlers();
  }

  private setupMiddleware(): void {
    // Trust proxy (for accurate IP addresses behind load balancers)
    this.app.set('trust proxy', 1);

    // Security middleware (should be first)
    this.app.use(securityHeaders);
    this.app.use(addSecurityHeaders);
    this.app.use(suspiciousRequestDetector);

    // CORS
    this.app.use(cors(corsOptions));

    // Request size validation
    this.app.use(validateRequestSize(5 * 1024 * 1024)); // 5MB limit

    // Body parsing
    this.app.use(json({ limit: '5mb' }));
    this.app.use(urlencoded({ extended: true, limit: '5mb' }));

    // Compression
    this.app.use(compression());

    // Request sanitization and validation
    this.app.use(sanitizeRequest);
    this.app.use(sanitize);
    this.app.use(preventParameterPollution);
    // Content type and API version validation handled by RequestValidator

    // Enhanced request logging
    this.app.use(RequestLogger.createLogger({
      logBody: process.env.NODE_ENV === 'development',
      logHeaders: true,
      logQuery: true
    }));

    // Global rate limiting (fallback)
    this.app.use('/api', createApiRateLimiter(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API status endpoint
    this.app.get('/api/status', async (req, res) => {
      try {
        const [
          dbStatus,
          redisStatus,
          marketDataStatus,
          strategyEngineStatus,
          executionEngineStatus
        ] = await Promise.all([
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.checkMarketDataHealth(),
          this.checkStrategyEngineHealth(),
          this.checkExecutionEngineHealth()
        ]);

        const overallStatus = [
          dbStatus,
          redisStatus,
          marketDataStatus,
          strategyEngineStatus,
          executionEngineStatus
        ].every(status => status === 'healthy') ? 'healthy' : 'degraded';

        res.json({
          success: true,
          status: overallStatus,
          services: {
            database: dbStatus,
            redis: redisStatus,
            marketData: marketDataStatus,
            strategyEngine: strategyEngineStatus,
            executionEngine: executionEngineStatus
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Status check failed:', error);
        res.status(500).json({
          success: false,
          status: 'unhealthy',
          error: 'Status check failed'
        });
      }
    });

    // Use API Gateway for all API routes
    this.app.use('/api/v1', this.apiGateway.getRouter());

    // Gateway metrics endpoint (admin only)
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const date = req.query.date as string;
        const metrics = await RequestLogger.getMetrics(date);
        
        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve metrics'
        });
      }
    });
  }

  private setupErrorHandling(): void {
    // Request error logger (before other error handlers)
    this.app.use(RequestLogger.createErrorLogger());

    // 404 handler (must be after all routes)
    this.app.use(notFoundHandler);

    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  private async checkDatabaseHealth(): Promise<string> {
    try {
      const { db } = await import('@/database');
      await db.query('SELECT 1');
      return 'healthy';
    } catch (error) {
      logger.error('Database health check failed:', error);
      return 'unhealthy';
    }
  }

  private async checkRedisHealth(): Promise<string> {
    try {
      await redisService.ping();
      return 'healthy';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return 'unhealthy';
    }
  }

  private async checkMarketDataHealth(): Promise<string> {
    try {
      const stats = marketDataManager.getStats();
      return stats.connectionStatus.connected ? 'healthy' : 'degraded';
    } catch (error) {
      logger.error('Market data health check failed:', error);
      return 'unhealthy';
    }
  }

  private async checkStrategyEngineHealth(): Promise<string> {
    try {
      const health = await strategyEngine.healthCheck();
      return health.status;
    } catch (error) {
      logger.error('Strategy engine health check failed:', error);
      return 'unhealthy';
    }
  }

  private async checkExecutionEngineHealth(): Promise<string> {
    try {
      const health = await executionEngine.healthCheck();
      return health.status;
    } catch (error) {
      logger.error('Execution engine health check failed:', error);
      return 'unhealthy';
    }
  }

  private setupMonitoringIntegrations(): void {
    // Setup performance monitoring for critical operations
    performanceMonitor.on('metric', (metric) => {
      // Evaluate performance metrics against alert rules
      alertManager.evaluateRules(metric, 'performance-monitor');
    });

    // Setup system monitoring alerts
    systemMonitor.on('statusUpdate', (status) => {
      // Evaluate system status against alert rules
      alertManager.evaluateRules(status, 'system-monitor');
      
      // Log system status changes
      if (status.overall !== 'healthy') {
        logger.warn('System status changed', {
          status: status.overall,
          services: status.services.filter(s => s.status !== 'healthy'),
          type: 'SYSTEM_STATUS_CHANGE'
        });
      }
    });

    // Setup alert notifications
    alertManager.on('alert', (alert) => {
      logger.warn('Alert triggered', {
        alertId: alert.id,
        level: alert.level,
        title: alert.title,
        source: alert.source,
        type: 'ALERT_TRIGGERED'
      });
    });

    // Register custom health checks for our services
    systemMonitor.registerHealthCheck('market-data', async () => {
      try {
        const stats = marketDataManager.getStats();
        if (!stats.connectionStatus.connected) {
          return {
            status: 'unhealthy',
            message: 'Market data connection is down'
          };
        }
        return {
          status: 'healthy',
          message: 'Market data connection is active',
          metadata: stats
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Market data check failed: ${error instanceof Error ? error.message : error}`
        };
      }
    });

    systemMonitor.registerHealthCheck('strategy-engine', async () => {
      try {
        const health = await strategyEngine.healthCheck();
        return {
          status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
          message: health.message || 'Strategy engine status check',
          metadata: health
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Strategy engine check failed: ${error instanceof Error ? error.message : error}`
        };
      }
    });

    systemMonitor.registerHealthCheck('execution-engine', async () => {
      try {
        const health = await executionEngine.healthCheck();
        return {
          status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
          message: health.message || 'Execution engine status check',
          metadata: health
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Execution engine check failed: ${error instanceof Error ? error.message : error}`
        };
      }
    });

    logger.info('Monitoring integrations configured');
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing AURA Trading System...');

      // Initialize database
      await initializeDatabase();
      logger.info('Database initialized');

      // Initialize Redis
      await redisService.connect();
      logger.info('Redis connected');

      // Initialize market data manager
      await marketDataManager.initialize();
      logger.info('Market data manager initialized');

      // Initialize strategy engine
      await strategyEngine.initialize();
      logger.info('Strategy engine initialized');

      // Initialize execution engine
      await executionEngine.initialize();
      logger.info('Execution engine initialized');

      // Initialize monitoring systems
      systemMonitor.start();
      performanceMonitor.start();
      logger.info('Monitoring systems started');

      // Setup monitoring integrations
      this.setupMonitoringIntegrations();

      logger.info('AURA Trading System initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AURA Trading System:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down AURA Trading System...');

    try {
      // Shutdown monitoring systems first
      systemMonitor.stop();
      performanceMonitor.stop();
      logger.info('Monitoring systems stopped');

      // Shutdown services in reverse order
      await executionEngine.shutdown();
      logger.info('Execution engine shutdown');

      await strategyEngine.shutdown();
      logger.info('Strategy engine shutdown');

      await marketDataManager.shutdown();
      logger.info('Market data manager shutdown');

      await redisService.disconnect();
      logger.info('Redis disconnected');

      const { closeDatabaseConnection } = await import('@/database');
      await closeDatabaseConnection();
      logger.info('Database connection closed');

      logger.info('AURA Trading System shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  public listen(port: number): void {
    const server = this.app.listen(port, () => {
      logger.info(`AURA Trading System API listening on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`API status: http://localhost:${port}/api/status`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        await this.shutdown();
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }
}

export default App;