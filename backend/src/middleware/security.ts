import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '@/utils/logger';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'API-Version',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ]
};

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Remove potentially dangerous characters
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip potentially dangerous keys
        if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
          sanitized[key] = sanitize(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Skip in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      next();
    } else {
      logger.warn('IP blocked:', { ip: clientIP, url: req.url });
      res.status(403).json({
        success: false,
        error: 'Access denied from this IP address',
        code: 'IP_BLOCKED'
      });
    }
  };
};

/**
 * API key validation middleware
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.get('X-API-Key');
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  // Skip if no API keys configured
  if (validApiKeys.length === 0) {
    return next();
  }

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
    return;
  }

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key used:', { apiKey: apiKey.substring(0, 8) + '...' });
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }

  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log request
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: (req as any).user?.id
    });
  });

  next();
};

/**
 * Prevent parameter pollution
 */
export const preventParameterPollution = (req: Request, res: Response, next: NextFunction): void => {
  // Convert array parameters to single values (keep last one)
  const cleanParams = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        // Keep only the last value for most parameters
        // Exception: allow arrays for specific parameters
        const allowArrays = ['tags', 'categories', 'ids'];
        if (allowArrays.includes(key)) {
          cleaned[key] = value;
        } else {
          cleaned[key] = value[value.length - 1];
        }
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  if (req.query) {
    req.query = cleanParams(req.query);
  }

  next();
};

/**
 * Detect and block suspicious requests
 */
export const suspiciousRequestDetector = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /\.\.\//g, // Path traversal
    /<script/gi, // XSS attempts
    /union\s+select/gi, // SQL injection
    /exec\s*\(/gi, // Code execution
    /eval\s*\(/gi, // Code evaluation
    /document\.cookie/gi, // Cookie theft
    /javascript:/gi, // JavaScript protocol
  ];

  const checkString = (str: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkObject);
    }
    
    return false;
  };

  // Check URL
  if (checkString(req.url)) {
    logger.warn('Suspicious URL detected:', { url: req.url, ip: req.ip });
    res.status(400).json({
      success: false,
      error: 'Suspicious request detected',
      code: 'SUSPICIOUS_REQUEST'
    });
    return;
  }

  // Check request body
  if (req.body && checkObject(req.body)) {
    logger.warn('Suspicious request body detected:', { ip: req.ip, url: req.url });
    res.status(400).json({
      success: false,
      error: 'Suspicious request detected',
      code: 'SUSPICIOUS_REQUEST'
    });
    return;
  }

  // Check query parameters
  if (req.query && checkObject(req.query)) {
    logger.warn('Suspicious query parameters detected:', { ip: req.ip, url: req.url });
    res.status(400).json({
      success: false,
      error: 'Suspicious request detected',
      code: 'SUSPICIOUS_REQUEST'
    });
    return;
  }

  next();
};

/**
 * Add security response headers
 */
export const addSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'X-API-Version': 'v1'
  });

  next();
};