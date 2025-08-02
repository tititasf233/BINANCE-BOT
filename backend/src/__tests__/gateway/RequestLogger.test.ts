import request from 'supertest';
import express from 'express';
import RequestLogger from '@/gateway/RequestLogger';
import { redisService } from '@/services/RedisService';

// Mock dependencies
jest.mock('@/services/RedisService');
jest.mock('@/utils/logger');

describe('RequestLogger', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock Redis service
    (redisService.set as jest.Mock).mockResolvedValue(true);
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (redisService.increment as jest.Mock).mockResolvedValue(1);
    (redisService.addToList as jest.Mock).mockResolvedValue(true);
    (redisService.expire as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Logging Middleware', () => {
    it('should log request start and completion', async () => {
      const logger = jest.requireMock('@/utils/logger').logger;
      
      app.use(RequestLogger.createLogger());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test')
        .expect(200);

      // Should log request start
      expect(logger.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          ip: expect.any(String),
          timestamp: expect.any(String)
        })
      );

      // Should log request completion
      expect(logger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          statusCode: 200,
          duration: expect.any(Number)
        })
      );
    });

    it('should generate unique request IDs', async () => {
      let requestId1: string;
      let requestId2: string;

      app.use(RequestLogger.createLogger());
      app.get('/test', (req, res) => {
        if (!requestId1) {
          requestId1 = (req as any).requestId;
        } else {
          requestId2 = (req as any).requestId;
        }
        res.json({ requestId: (req as any).requestId });
      });

      await request(app).get('/test');
      await request(app).get('/test');

      expect(requestId1).toBeDefined();
      expect(requestId2).toBeDefined();
      expect(requestId1).not.toBe(requestId2);
    });

    it('should sanitize sensitive headers', async () => {
      app.use(RequestLogger.createLogger({ logHeaders: true }));
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/test')
        .set('Authorization', 'Bearer secret-token')
        .set('X-API-Key', 'secret-key')
        .set('User-Agent', 'test-agent')
        .expect(200);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^request:req_/),
        expect.objectContaining({
          headers: expect.objectContaining({
            'authorization': '[REDACTED]',
            'x-api-key': '[REDACTED]',
            'user-agent': 'test-agent'
          })
        }),
        3600
      );
    });

    it('should sanitize sensitive body fields', async () => {
      app.use(RequestLogger.createLogger({ logBody: true }));
      app.post('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/test')
        .send({
          username: 'testuser',
          password: 'secret123',
          apiKey: 'secret-api-key',
          publicData: 'visible'
        })
        .expect(200);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^request:req_/),
        expect.objectContaining({
          body: {
            username: 'testuser',
            password: '[REDACTED]',
            apiKey: '[REDACTED]',
            publicData: 'visible'
          }
        }),
        3600
      );
    });

    it('should log errors for failed requests', async () => {
      const logger = jest.requireMock('@/utils/logger').logger;
      
      app.use(RequestLogger.createLogger());
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(logger.error).toHaveBeenCalledWith(
        'Request completed with error',
        expect.objectContaining({
          method: 'GET',
          path: '/error',
          statusCode: 500
        })
      );
    });

    it('should store request data in Redis', async () => {
      app.use(RequestLogger.createLogger());
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/test')
        .expect(200);

      // Should store initial request data
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^request:req_/),
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          timestamp: expect.any(String)
        }),
        3600
      );

      // Should update with response data
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^request:req_/),
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          statusCode: 200,
          duration: expect.any(Number)
        }),
        3600
      );
    });
  });

  describe('Error Logging Middleware', () => {
    it('should log errors with request context', async () => {
      const logger = jest.requireMock('@/utils/logger').logger;
      
      app.use(RequestLogger.createLogger());
      app.get('/error', (req, res, next) => {
        const error = new Error('Test error');
        next(error);
      });
      app.use(RequestLogger.createErrorLogger());
      app.use((error: Error, req: any, res: any, next: any) => {
        res.status(500).json({ error: error.message });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(logger.error).toHaveBeenCalledWith(
        'Request error',
        expect.objectContaining({
          error: 'Test error',
          path: '/error',
          method: 'GET',
          ip: expect.any(String)
        })
      );
    });

    it('should update request data with error information', async () => {
      const mockRequestData = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/error'
      };

      (redisService.get as jest.Mock).mockResolvedValue(mockRequestData);

      app.use(RequestLogger.createLogger());
      app.get('/error', (req, res, next) => {
        (req as any).requestId = 'test-request-id';
        const error = new Error('Test error');
        next(error);
      });
      app.use(RequestLogger.createErrorLogger());
      app.use((error: Error, req: any, res: any, next: any) => {
        res.status(500).json({ error: error.message });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(redisService.set).toHaveBeenCalledWith(
        'request:test-request-id',
        expect.objectContaining({
          ...mockRequestData,
          error: 'Test error'
        }),
        3600
      );
    });
  });

  describe('Metrics Collection', () => {
    it('should store daily metrics', async () => {
      app.use(RequestLogger.createLogger());
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/test')
        .expect(200);

      const today = new Date().toISOString().split('T')[0];
      
      expect(redisService.increment).toHaveBeenCalledWith(`metrics:daily:${today}:requests`);
      expect(redisService.increment).toHaveBeenCalledWith(`metrics:daily:${today}:get_requests`);
    });

    it('should store error metrics for failed requests', async () => {
      app.use(RequestLogger.createLogger());
      app.get('/error', (req, res) => res.status(404).json({ error: 'Not found' }));

      await request(app)
        .get('/error')
        .expect(404);

      const today = new Date().toISOString().split('T')[0];
      
      expect(redisService.increment).toHaveBeenCalledWith(`metrics:daily:${today}:errors`);
      expect(redisService.increment).toHaveBeenCalledWith(`metrics:daily:${today}:status_404`);
    });

    it('should store response time metrics', async () => {
      app.use(RequestLogger.createLogger());
      app.get('/test', (req, res) => {
        setTimeout(() => res.json({ success: true }), 10);
      });

      await request(app)
        .get('/test')
        .expect(200);

      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      
      expect(redisService.addToList).toHaveBeenCalledWith(
        `metrics:hourly:${today}:${hour}:response_times`,
        expect.any(String),
        1000
      );
    });
  });

  describe('Metrics Retrieval', () => {
    it('should get daily metrics', async () => {
      const mockMetrics = {
        'metrics:daily:2023-01-01:requests': '100',
        'metrics:daily:2023-01-01:get_requests': '60',
        'metrics:daily:2023-01-01:post_requests': '30',
        'metrics:daily:2023-01-01:put_requests': '5',
        'metrics:daily:2023-01-01:delete_requests': '5',
        'metrics:daily:2023-01-01:errors': '10'
      };

      (redisService.get as jest.Mock).mockImplementation((key: string) => {
        return Promise.resolve(mockMetrics[key] || '0');
      });

      const metrics = await RequestLogger.getMetrics('2023-01-01');

      expect(metrics).toEqual({
        date: '2023-01-01',
        totalRequests: 100,
        requestsByMethod: {
          GET: 60,
          POST: 30,
          PUT: 5,
          DELETE: 5
        },
        errors: 10,
        errorRate: 10
      });
    });

    it('should get request by ID', async () => {
      const mockRequestData = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/test',
        statusCode: 200
      };

      (redisService.get as jest.Mock).mockResolvedValue(mockRequestData);

      const requestData = await RequestLogger.getRequestById('test-request-id');

      expect(requestData).toEqual(mockRequestData);
      expect(redisService.get).toHaveBeenCalledWith('request:test-request-id', true);
    });

    it('should return null for non-existent request ID', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const requestData = await RequestLogger.getRequestById('non-existent-id');

      expect(requestData).toBeNull();
    });
  });
});