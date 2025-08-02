import request from 'supertest';
import express from 'express';
import ApiGateway from '@/gateway/ApiGateway';
import RequestValidator from '@/gateway/RequestValidator';
import { redisService } from '@/services/RedisService';

// Mock dependencies
jest.mock('@/services/RedisService');
jest.mock('@/utils/logger');
jest.mock('@/middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => next())
}));

describe('ApiGateway', () => {
  let app: express.Application;
  let gateway: ApiGateway;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    gateway = new ApiGateway();
    app.use('/api/v1', gateway.getRouter());
    
    // Mock Redis service
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (redisService.set as jest.Mock).mockResolvedValue(true);
    (redisService.increment as jest.Mock).mockResolvedValue(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Route Configuration', () => {
    it('should have all required routes configured', () => {
      const routes = gateway.getRoutes();
      
      expect(routes).toHaveLength(5);
      expect(routes.map(r => r.path)).toEqual([
        '/auth',
        '/api-keys',
        '/strategies',
        '/portfolio',
        '/backtest'
      ]);
    });

    it('should configure authentication requirements correctly', () => {
      const routes = gateway.getRoutes();
      
      // Auth route should not require authentication
      const authRoute = routes.find(r => r.path === '/auth');
      expect(authRoute?.requireAuth).toBe(false);
      
      // Other routes should require authentication
      const protectedRoutes = routes.filter(r => r.path !== '/auth');
      protectedRoutes.forEach(route => {
        expect(route.requireAuth).toBe(true);
      });
    });

    it('should configure rate limiting correctly', () => {
      const routes = gateway.getRoutes();
      
      // Check specific rate limits
      const apiKeysRoute = routes.find(r => r.path === '/api-keys');
      expect(apiKeysRoute?.rateLimit).toEqual({
        maxRequests: 50,
        windowMs: 15 * 60 * 1000
      });
      
      const strategiesRoute = routes.find(r => r.path === '/strategies');
      expect(strategiesRoute?.rateLimit).toEqual({
        maxRequests: 100,
        windowMs: 15 * 60 * 1000
      });
    });
  });

  describe('Documentation Endpoint', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api/v1/docs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('version', 'v1');
      expect(response.body.data).toHaveProperty('routes');
      expect(response.body.data).toHaveProperty('authentication');
      expect(response.body.data).toHaveProperty('websocket');
      expect(response.body.data).toHaveProperty('rateLimit');
    });

    it('should include all routes in documentation', async () => {
      const response = await request(app)
        .get('/api/v1/docs')
        .expect(200);

      const routes = response.body.data.routes;
      expect(routes).toHaveLength(5);
      
      const routePaths = routes.map((r: any) => r.path);
      expect(routePaths).toContain('/auth');
      expect(routePaths).toContain('/api-keys');
      expect(routePaths).toContain('/strategies');
      expect(routePaths).toContain('/portfolio');
      expect(routePaths).toContain('/backtest');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return gateway health status', async () => {
      const response = await request(app)
        .get('/api/v1/gateway/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.gateway).toHaveProperty('routes', 5);
      expect(response.body.gateway).toHaveProperty('uptime');
      expect(response.body.gateway).toHaveProperty('memory');
      expect(response.body.gateway).toHaveProperty('timestamp');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return gateway metrics for authenticated users', async () => {
      // Mock authentication middleware
      const mockAuth = jest.requireMock('@/middleware/auth');
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id' };
        next();
      });

      const response = await request(app)
        .get('/api/v1/gateway/metrics')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metrics).toHaveProperty('totalRoutes', 5);
      expect(response.body.metrics).toHaveProperty('routeDetails');
      expect(response.body.metrics.routeDetails).toHaveLength(5);
    });
  });

  describe('Route Management', () => {
    it('should allow adding new routes', () => {
      const testRouter = express.Router();
      testRouter.get('/test', (req, res) => res.json({ test: true }));

      gateway.addRoute({
        path: '/test',
        router: testRouter,
        requireAuth: false,
        description: 'Test route'
      });

      const routes = gateway.getRoutes();
      expect(routes).toHaveLength(6);
      
      const testRoute = routes.find(r => r.path === '/test');
      expect(testRoute).toBeDefined();
      expect(testRoute?.requireAuth).toBe(false);
      expect(testRoute?.description).toBe('Test route');
    });

    it('should allow removing routes', () => {
      gateway.removeRoute('/auth');
      
      const routes = gateway.getRoutes();
      expect(routes).toHaveLength(4);
      expect(routes.find(r => r.path === '/auth')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes with 404', async () => {
      await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);
    });

    it('should handle server errors gracefully', async () => {
      // Create a route that throws an error
      const errorRouter = express.Router();
      errorRouter.get('/error', () => {
        throw new Error('Test error');
      });

      gateway.addRoute({
        path: '/error',
        router: errorRouter,
        requireAuth: false
      });

      await request(app)
        .get('/api/v1/error')
        .expect(500);
    });
  });
});

describe('RequestValidator', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Schema Validation', () => {
    it('should validate request body correctly', async () => {
      app.post('/test', 
        RequestValidator.validate({
          body: RequestValidator.schemas.userLogin
        }),
        (req, res) => res.json({ success: true })
      );

      // Valid request
      await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'validpassword'
        })
        .expect(200);

      // Invalid request
      await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: ''
        })
        .expect(400);
    });

    it('should validate query parameters correctly', async () => {
      app.get('/test',
        RequestValidator.validate({
          query: RequestValidator.schemas.pagination
        }),
        (req, res) => res.json({ success: true })
      );

      // Valid request
      await request(app)
        .get('/test?page=1&limit=20')
        .expect(200);

      // Invalid request
      await request(app)
        .get('/test?page=0&limit=200')
        .expect(400);
    });

    it('should validate path parameters correctly', async () => {
      app.get('/test/:id',
        RequestValidator.validate({
          params: RequestValidator.schemas.idParam
        }),
        (req, res) => res.json({ success: true })
      );

      // Valid request
      await request(app)
        .get('/test/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      // Invalid request
      await request(app)
        .get('/test/invalid-uuid')
        .expect(400);
    });
  });

  describe('Content Type Validation', () => {
    it('should validate content type correctly', async () => {
      app.use(RequestValidator.validateContentType(['application/json']));
      app.post('/test', (req, res) => res.json({ success: true }));

      // Valid content type
      await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send({ test: true })
        .expect(200);

      // Invalid content type
      await request(app)
        .post('/test')
        .set('Content-Type', 'text/plain')
        .send('test')
        .expect(415);
    });

    it('should skip content type validation for GET requests', async () => {
      app.use(RequestValidator.validateContentType(['application/json']));
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/test')
        .expect(200);
    });
  });

  describe('Request Size Validation', () => {
    it('should validate request size correctly', async () => {
      app.use(RequestValidator.validateRequestSize(100)); // 100 bytes limit
      app.post('/test', (req, res) => res.json({ success: true }));

      // Small request (should pass)
      await request(app)
        .post('/test')
        .send({ small: 'data' })
        .expect(200);

      // Large request (should fail)
      const largeData = 'x'.repeat(200);
      await request(app)
        .post('/test')
        .set('Content-Length', '200')
        .send({ large: largeData })
        .expect(413);
    });
  });

  describe('API Version Validation', () => {
    it('should validate API version correctly', async () => {
      app.use(RequestValidator.validateApiVersion(['v1', 'v2']));
      app.get('/test', (req, res) => res.json({ version: (req as any).apiVersion }));

      // Valid version
      await request(app)
        .get('/test')
        .set('API-Version', 'v1')
        .expect(200);

      // Invalid version
      await request(app)
        .get('/test')
        .set('API-Version', 'v3')
        .expect(400);

      // Default version (v1)
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.body.version).toBe('v1');
    });
  });
});