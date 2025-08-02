import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { redisService } from '@/services/RedisService';

export interface RequestLogData {
  requestId: string;
  method: string;
  path: string;
  query: any;
  headers: Record<string, string>;
  body?: any;
  ip: string;
  userAgent: string;
  userId?: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: string;
}

export class RequestLogger {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create request logging middleware
   */
  static createLogger(options: {
    logBody?: boolean;
    logHeaders?: boolean;
    logQuery?: boolean;
    sensitiveHeaders?: string[];
    sensitiveBodyFields?: string[];
  } = {}) {
    const {
      logBody = false,
      logHeaders = true,
      logQuery = true,
      sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'],
      sensitiveBodyFields = ['password', 'apiKey', 'secretKey', 'token']
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      const requestId = RequestLogger.generateRequestId();
      const startTime = Date.now();
      
      // Add request ID to request object
      (req as any).requestId = requestId;

      // Sanitize headers
      const sanitizedHeaders: Record<string, string> = {};
      if (logHeaders) {
        Object.entries(req.headers).forEach(([key, value]) => {
          if (sensitiveHeaders.includes(key.toLowerCase())) {
            sanitizedHeaders[key] = '[REDACTED]';
          } else {
            sanitizedHeaders[key] = Array.isArray(value) ? value.join(', ') : (value || '');
          }
        });
      }

      // Sanitize body
      let sanitizedBody: any = undefined;
      if (logBody && req.body) {
        sanitizedBody = { ...req.body };
        sensitiveBodyFields.forEach(field => {
          if (sanitizedBody[field]) {
            sanitizedBody[field] = '[REDACTED]';
          }
        });
      }

      // Create initial log data
      const logData: RequestLogData = {
        requestId,
        method: req.method,
        path: req.path,
        query: logQuery ? req.query : undefined,
        headers: sanitizedHeaders,
        body: sanitizedBody,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        userId: (req as any).user?.id,
        timestamp: new Date().toISOString()
      };

      // Log request start
      logger.info('Request started', logData);

      // Store request data in Redis for correlation
      redisService.set(`request:${requestId}`, logData, 3600); // 1 hour TTL

      // Override res.end to capture response data
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const duration = Date.now() - startTime;
        const responseSize = res.get('Content-Length') || (chunk ? Buffer.byteLength(chunk) : 0);

        // Update log data with response information
        const finalLogData: RequestLogData = {
          ...logData,
          duration,
          statusCode: res.statusCode,
          responseSize: typeof responseSize === 'string' ? parseInt(responseSize, 10) : responseSize
        };

        // Log request completion
        if (res.statusCode >= 400) {
          logger.error('Request completed with error', finalLogData);
        } else {
          logger.info('Request completed', finalLogData);
        }

        // Update Redis data
        redisService.set(`request:${requestId}`, finalLogData, 3600);

        // Store metrics for analytics
        RequestLogger.storeMetrics(finalLogData);

        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Store request metrics for analytics
   */
  private static async storeMetrics(logData: RequestLogData): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const hour = new Date().getHours();
      
      // Store daily metrics
      const dailyKey = `metrics:daily:${date}`;
      await redisService.increment(`${dailyKey}:requests`);
      await redisService.increment(`${dailyKey}:${logData.method.toLowerCase()}_requests`);
      
      if (logData.statusCode && logData.statusCode >= 400) {
        await redisService.increment(`${dailyKey}:errors`);
        await redisService.increment(`${dailyKey}:status_${logData.statusCode}`);
      }

      // Store hourly metrics
      const hourlyKey = `metrics:hourly:${date}:${hour}`;
      await redisService.increment(`${hourlyKey}:requests`);
      
      if (logData.duration) {
        // Store response time metrics
        const responseTimeKey = `${hourlyKey}:response_times`;
        await redisService.addToList(responseTimeKey, logData.duration.toString(), 1000); // Keep last 1000 response times
      }

      // Store endpoint-specific metrics
      const endpointKey = `metrics:endpoint:${logData.method}:${logData.path.replace(/\/\d+/g, '/:id')}`;
      await redisService.increment(`${endpointKey}:${date}:requests`);
      
      if (logData.duration) {
        await redisService.addToList(`${endpointKey}:${date}:response_times`, logData.duration.toString(), 100);
      }

      // Store user-specific metrics if available
      if (logData.userId) {
        const userKey = `metrics:user:${logData.userId}:${date}`;
        await redisService.increment(`${userKey}:requests`);
      }

      // Set TTL for metrics (30 days)
      await redisService.expire(dailyKey, 30 * 24 * 60 * 60);
      await redisService.expire(hourlyKey, 30 * 24 * 60 * 60);
      await redisService.expire(endpointKey, 30 * 24 * 60 * 60);

    } catch (error) {
      logger.error('Failed to store request metrics', { error, requestId: logData.requestId });
    }
  }

  /**
   * Get request metrics
   */
  static async getMetrics(date?: string): Promise<any> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dailyKey = `metrics:daily:${targetDate}`;

      const [
        totalRequests,
        getRequests,
        postRequests,
        putRequests,
        deleteRequests,
        errors
      ] = await Promise.all([
        redisService.get(`${dailyKey}:requests`),
        redisService.get(`${dailyKey}:get_requests`),
        redisService.get(`${dailyKey}:post_requests`),
        redisService.get(`${dailyKey}:put_requests`),
        redisService.get(`${dailyKey}:delete_requests`),
        redisService.get(`${dailyKey}:errors`)
      ]);

      return {
        date: targetDate,
        totalRequests: parseInt(totalRequests || '0', 10),
        requestsByMethod: {
          GET: parseInt(getRequests || '0', 10),
          POST: parseInt(postRequests || '0', 10),
          PUT: parseInt(putRequests || '0', 10),
          DELETE: parseInt(deleteRequests || '0', 10)
        },
        errors: parseInt(errors || '0', 10),
        errorRate: totalRequests ? (parseInt(errors || '0', 10) / parseInt(totalRequests, 10)) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get request metrics', { error, date });
      throw error;
    }
  }

  /**
   * Get request by ID
   */
  static async getRequestById(requestId: string): Promise<RequestLogData | null> {
    try {
      return await redisService.get<RequestLogData>(`request:${requestId}`, true);
    } catch (error) {
      logger.error('Failed to get request by ID', { error, requestId });
      return null;
    }
  }

  /**
   * Create error logging middleware
   */
  static createErrorLogger() {
    return (error: Error, req: Request, res: Response, next: NextFunction): void => {
      const requestId = (req as any).requestId;
      
      logger.error('Request error', {
        requestId,
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.id
      });

      // Update request data in Redis with error information
      if (requestId) {
        redisService.get<RequestLogData>(`request:${requestId}`, true)
          .then(logData => {
            if (logData) {
              const updatedLogData = {
                ...logData,
                error: error.message
              };
              redisService.set(`request:${requestId}`, updatedLogData, 3600);
            }
          })
          .catch(err => logger.error('Failed to update request data with error', err));
      }

      next(error);
    };
  }
}

export default RequestLogger;