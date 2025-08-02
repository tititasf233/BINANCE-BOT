import { Request, Response, NextFunction } from 'express';
import { redisService } from '@/services/RedisService';
import { logger } from '@/utils/logger';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
}

export class RateLimiter {
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      message: options.message || 'Too many requests, please try again later',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator
    };
  }

  private defaultKeyGenerator(req: Request): string {
    return req.ip || 'unknown';
  }

  /**
   * Create rate limiting middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = `rate_limit:${this.options.keyGenerator(req)}`;
        const now = Date.now();
        const windowStart = now - this.options.windowMs;

        // Get current request count
        const requestsData = await redisService.get<{ count: number; resetTime: number }>(key, true);
        
        let requestCount = 0;
        let resetTime = now + this.options.windowMs;

        if (requestsData) {
          if (now < requestsData.resetTime) {
            // Within the current window
            requestCount = requestsData.count;
            resetTime = requestsData.resetTime;
          }
          // If past reset time, start new window (requestCount stays 0)
        }

        // Check if limit exceeded
        if (requestCount >= this.options.maxRequests) {
          const retryAfter = Math.ceil((resetTime - now) / 1000);
          
          res.set({
            'X-RateLimit-Limit': this.options.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            'Retry-After': retryAfter.toString()
          });

          res.status(429).json({
            success: false,
            error: this.options.message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter
          });
          return;
        }

        // Set response headers
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': (this.options.maxRequests - requestCount - 1).toString(),
          'X-RateLimit-Reset': new Date(resetTime).toISOString()
        });

        // Increment counter (unless we should skip this request)
        const shouldSkip = this.shouldSkipRequest(req, res);
        if (!shouldSkip) {
          await redisService.set(key, {
            count: requestCount + 1,
            resetTime
          }, Math.ceil(this.options.windowMs / 1000));
        }

        next();

      } catch (error) {
        logger.error('Rate limiter error:', error);
        // On error, allow the request to proceed
        next();
      }
    };
  }

  private shouldSkipRequest(req: Request, res: Response): boolean {
    if (this.options.skipSuccessfulRequests && res.statusCode < 400) {
      return true;
    }
    
    if (this.options.skipFailedRequests && res.statusCode >= 400) {
      return true;
    }

    return false;
  }
}

/**
 * Create a rate limiter for general API usage
 */
export const createApiRateLimiter = (maxRequests: number, windowMs: number) => {
  return new RateLimiter({
    windowMs,
    maxRequests,
    message: `Too many API requests. Limit: ${maxRequests} requests per ${windowMs / 1000} seconds`,
    keyGenerator: (req: Request) => {
      // Use IP address as default, but prefer authenticated user ID
      const user = (req as any).user;
      return user ? `user:${user.id}` : `ip:${req.ip}`;
    }
  }).middleware();
};

/**
 * Create a rate limiter for authentication endpoints
 */
export const createAuthRateLimiter = () => {
  return new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (req: Request) => `auth:${req.ip}`,
    skipSuccessfulRequests: true // Don't count successful logins
  }).middleware();
};

/**
 * Create a rate limiter for expensive operations
 */
export const createExpensiveOperationLimiter = () => {
  return new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 operations per hour
    message: 'Too many expensive operations, please try again later',
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      return user ? `expensive:user:${user.id}` : `expensive:ip:${req.ip}`;
    }
  }).middleware();
};