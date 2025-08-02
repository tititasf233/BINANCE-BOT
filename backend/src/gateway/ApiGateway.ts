import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { createApiRateLimiter, createAuthRateLimiter, createExpensiveOperationLimiter } from '@/middleware/rateLimiter';
import { authenticateToken } from '@/middleware/auth';

// Route imports
import authRoutes from '@/routes/auth';
import apiKeyRoutes from '@/routes/apiKeys';
import strategyRoutes from '@/routes/strategies';
import portfolioRoutes from '@/routes/portfolio';
import backtestRoutes from '@/routes/backtest';
import monitoringRoutes from '@/routes/monitoring';

export interface RouteConfig {
  path: string;
  router: Router;
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  requireAuth?: boolean;
  description?: string;
}

export class ApiGateway {
  private router: Router;
  private routes: RouteConfig[] = [];

  constructor() {
    this.router = Router();
    this.setupRoutes();
    this.setupMiddleware();
  }

  private setupRoutes(): void {
    // Define all API routes with their configurations
    this.routes = [
      {
        path: '/auth',
        router: authRoutes,
        middleware: [createAuthRateLimiter()],
        requireAuth: false,
        description: 'Authentication endpoints (login, register, refresh)'
      },
      {
        path: '/api-keys',
        router: apiKeyRoutes,
        requireAuth: true,
        rateLimit: { maxRequests: 50, windowMs: 15 * 60 * 1000 }, // 50 requests per 15 minutes
        description: 'API key management endpoints'
      },
      {
        path: '/strategies',
        router: strategyRoutes,
        requireAuth: true,
        rateLimit: { maxRequests: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
        description: 'Trading strategy management endpoints'
      },
      {
        path: '/portfolio',
        router: portfolioRoutes,
        requireAuth: true,
        rateLimit: { maxRequests: 200, windowMs: 15 * 60 * 1000 }, // 200 requests per 15 minutes
        description: 'Portfolio and position management endpoints'
      },
      {
        path: '/backtest',
        router: backtestRoutes,
        middleware: [createExpensiveOperationLimiter()],
        requireAuth: true,
        description: 'Backtesting endpoints (rate limited due to computational cost)'
      },
      {
        path: '/monitoring',
        router: monitoringRoutes,
        requireAuth: true,
        rateLimit: { maxRequests: 300, windowMs: 15 * 60 * 1000 }, // 300 requests per 15 minutes
        description: 'System monitoring, health checks, alerts, and performance metrics'
      }
    ];
  }

  private setupMiddleware(): void {
    // Request logging middleware
    this.router.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const user = (req as any).user;
        
        logger.info('API Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: user?.id,
          contentLength: res.get('Content-Length')
        });
      });

      next();
    });

    // Apply route configurations
    this.routes.forEach(routeConfig => {
      const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

      // Add custom rate limiting if specified
      if (routeConfig.rateLimit) {
        middlewares.push(
          createApiRateLimiter(routeConfig.rateLimit.maxRequests, routeConfig.rateLimit.windowMs)
        );
      }

      // Add authentication if required
      if (routeConfig.requireAuth) {
        middlewares.push(authenticateToken);
      }

      // Add custom middleware
      if (routeConfig.middleware) {
        middlewares.push(...routeConfig.middleware);
      }

      // Apply all middleware and router
      this.router.use(routeConfig.path, ...middlewares, routeConfig.router);
    });

    // API documentation endpoint
    this.router.get('/docs', (req: Request, res: Response) => {
      const documentation = {
        version: 'v1',
        description: 'AURA Trading System API',
        baseUrl: '/api/v1',
        routes: this.routes.map(route => ({
          path: route.path,
          fullPath: `/api/v1${route.path}`,
          description: route.description,
          requiresAuth: route.requireAuth,
          rateLimit: route.rateLimit
        })),
        authentication: {
          type: 'Bearer Token (JWT)',
          header: 'Authorization: Bearer <token>',
          endpoints: {
            login: '/api/v1/auth/login',
            register: '/api/v1/auth/register',
            refresh: '/api/v1/auth/refresh'
          }
        },
        websocket: {
          url: process.env.WS_URL || 'ws://localhost:3002',
          events: ['portfolio_update', 'trade_executed', 'strategy_signal', 'market_data']
        },
        rateLimit: {
          default: '100 requests per 15 minutes',
          auth: '5 attempts per 15 minutes',
          expensive: '10 operations per hour'
        }
      };

      res.json({
        success: true,
        data: documentation
      });
    });

    // Health check for gateway
    this.router.get('/gateway/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        status: 'healthy',
        gateway: {
          routes: this.routes.length,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      });
    });

    // Route metrics endpoint
    this.router.get('/gateway/metrics', authenticateToken, (req: Request, res: Response) => {
      // This would typically integrate with a metrics collection system
      res.json({
        success: true,
        metrics: {
          totalRoutes: this.routes.length,
          routeDetails: this.routes.map(route => ({
            path: route.path,
            requiresAuth: route.requireAuth,
            hasRateLimit: !!route.rateLimit,
            hasCustomMiddleware: !!route.middleware
          }))
        }
      });
    });
  }

  /**
   * Get the configured router
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Add a new route to the gateway
   */
  public addRoute(config: RouteConfig): void {
    this.routes.push(config);
    
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    if (config.rateLimit) {
      middlewares.push(
        createApiRateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs)
      );
    }

    if (config.requireAuth) {
      middlewares.push(authenticateToken);
    }

    if (config.middleware) {
      middlewares.push(...config.middleware);
    }

    this.router.use(config.path, ...middlewares, config.router);
    
    logger.info(`Added route to API Gateway: ${config.path}`, {
      requiresAuth: config.requireAuth,
      hasRateLimit: !!config.rateLimit,
      description: config.description
    });
  }

  /**
   * Remove a route from the gateway
   */
  public removeRoute(path: string): void {
    const index = this.routes.findIndex(route => route.path === path);
    if (index !== -1) {
      this.routes.splice(index, 1);
      logger.info(`Removed route from API Gateway: ${path}`);
    }
  }

  /**
   * Get route information
   */
  public getRoutes(): RouteConfig[] {
    return [...this.routes];
  }
}

export default ApiGateway;