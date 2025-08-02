import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

export interface ValidationOptions {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

/**
 * Create validation middleware
 */
export const validate = (options: ValidationOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (options.body) {
      const { error } = options.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details[0].message}`);
      }
    }

    // Validate request params
    if (options.params) {
      const { error } = options.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details[0].message}`);
      }
    }

    // Validate query parameters
    if (options.query) {
      const { error } = options.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details[0].message}`);
      }
    }

    // Validate headers
    if (options.headers) {
      const { error } = options.headers.validate(req.headers);
      if (error) {
        errors.push(`Headers: ${error.details[0].message}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed', {
        url: req.url,
        method: req.method,
        errors
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('created_at')
  }),

  // ID parameter
  id: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
  }),

  // Symbol validation
  symbol: Joi.string().uppercase().pattern(/^[A-Z]{2,10}$/).required(),

  // Interval validation
  interval: Joi.string().valid(
    '1m', '3m', '5m', '15m', '30m', 
    '1h', '2h', '4h', '6h', '8h', '12h', 
    '1d', '3d', '1w', '1M'
  ).required()
};

/**
 * Sanitize input data
 */
export const sanitize = (req: Request, res: Response, next: NextFunction): void => {
  // Remove null bytes
  const sanitizeString = (str: string): string => {
    return str.replace(/\0/g, '');
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request data
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Validate content type for POST/PUT requests
 */
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
      return;
    }
  }

  next();
};

/**
 * Validate API version
 */
export const validateApiVersion = (req: Request, res: Response, next: NextFunction): void => {
  const apiVersion = req.get('API-Version') || req.query.version;
  const supportedVersions = ['v1'];

  if (apiVersion && !supportedVersions.includes(apiVersion)) {
    res.status(400).json({
      success: false,
      error: `Unsupported API version: ${apiVersion}. Supported versions: ${supportedVersions.join(', ')}`,
      code: 'UNSUPPORTED_API_VERSION'
    });
    return;
  }

  next();
};

/**
 * Validate request size
 */
export const validateRequestSize = (maxSizeBytes: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        success: false,
        error: `Request too large. Maximum size: ${maxSizeBytes} bytes`,
        code: 'REQUEST_TOO_LARGE'
      });
      return;
    }

    next();
  };
};