import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
}

export class RequestValidator {
  /**
   * Create validation middleware for request data
   */
  static validate(schema: ValidationSchema, options: ValidationOptions = {}) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const validationOptions: Joi.ValidationOptions = {
        abortEarly: options.abortEarly ?? false,
        allowUnknown: options.allowUnknown ?? false,
        stripUnknown: options.stripUnknown ?? true
      };

      const errors: string[] = [];

      // Validate body
      if (schema.body && req.body) {
        const { error, value } = schema.body.validate(req.body, validationOptions);
        if (error) {
          errors.push(...error.details.map(detail => `Body: ${detail.message}`));
        } else {
          req.body = value;
        }
      }

      // Validate query parameters
      if (schema.query && req.query) {
        const { error, value } = schema.query.validate(req.query, validationOptions);
        if (error) {
          errors.push(...error.details.map(detail => `Query: ${detail.message}`));
        } else {
          req.query = value;
        }
      }

      // Validate path parameters
      if (schema.params && req.params) {
        const { error, value } = schema.params.validate(req.params, validationOptions);
        if (error) {
          errors.push(...error.details.map(detail => `Params: ${detail.message}`));
        } else {
          req.params = value;
        }
      }

      // Validate headers
      if (schema.headers && req.headers) {
        const { error } = schema.headers.validate(req.headers, validationOptions);
        if (error) {
          errors.push(...error.details.map(detail => `Headers: ${detail.message}`));
        }
      }

      if (errors.length > 0) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        });
        return;
      }

      next();
    };
  }

  /**
   * Common validation schemas
   */
  static schemas = {
    // Pagination schema
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }),

    // ID parameter schema
    idParam: Joi.object({
      id: Joi.string().uuid().required()
    }),

    // Date range schema
    dateRange: Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
    }),

    // Symbol validation
    symbol: Joi.string().pattern(/^[A-Z]{2,10}USDT?$/).required(),

    // Strategy parameters
    strategyParams: Joi.object({
      name: Joi.string().min(3).max(50).required(),
      symbol: Joi.string().pattern(/^[A-Z]{2,10}USDT?$/).required(),
      timeframe: Joi.string().valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d').required(),
      parameters: Joi.object().required(),
      riskManagement: Joi.object({
        maxPositionSize: Joi.number().positive().max(1).required(),
        stopLossPercentage: Joi.number().positive().max(0.5).required(),
        takeProfitPercentage: Joi.number().positive().max(2).required()
      }).required()
    }),

    // Backtest parameters
    backtestParams: Joi.object({
      strategyId: Joi.string().uuid().required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
      initialBalance: Joi.number().positive().default(10000),
      commission: Joi.number().min(0).max(0.01).default(0.001)
    }),

    // API key validation
    apiKey: Joi.object({
      name: Joi.string().min(3).max(50).required(),
      apiKey: Joi.string().min(10).required(),
      secretKey: Joi.string().min(10).required(),
      testnet: Joi.boolean().default(false)
    }),

    // User registration
    userRegistration: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
      firstName: Joi.string().min(2).max(50).required(),
      lastName: Joi.string().min(2).max(50).required()
    }),

    // User login
    userLogin: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    }),

    // Portfolio filters
    portfolioFilters: Joi.object({
      symbol: Joi.string().pattern(/^[A-Z]{2,10}USDT?$/).optional(),
      status: Joi.string().valid('active', 'closed', 'all').default('all'),
      strategyId: Joi.string().uuid().optional()
    })
  };

  /**
   * Validate request size
   */
  static validateRequestSize(maxSize: number) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const contentLength = parseInt(req.get('Content-Length') || '0', 10);
      
      if (contentLength > maxSize) {
        logger.warn('Request size exceeded limit', {
          path: req.path,
          method: req.method,
          contentLength,
          maxSize,
          ip: req.ip
        });

        res.status(413).json({
          success: false,
          error: 'Request entity too large',
          code: 'REQUEST_TOO_LARGE',
          maxSize: `${maxSize} bytes`
        });
        return;
      }

      next();
    };
  }

  /**
   * Validate content type
   */
  static validateContentType(allowedTypes: string[] = ['application/json']) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
      }

      const contentType = req.get('Content-Type');
      
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        logger.warn('Invalid content type', {
          path: req.path,
          method: req.method,
          contentType,
          allowedTypes,
          ip: req.ip
        });

        res.status(415).json({
          success: false,
          error: 'Unsupported media type',
          code: 'UNSUPPORTED_MEDIA_TYPE',
          allowedTypes
        });
        return;
      }

      next();
    };
  }

  /**
   * Validate API version
   */
  static validateApiVersion(supportedVersions: string[] = ['v1']) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const apiVersion = req.get('API-Version') || 'v1';
      
      if (!supportedVersions.includes(apiVersion)) {
        logger.warn('Unsupported API version', {
          path: req.path,
          method: req.method,
          apiVersion,
          supportedVersions,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          error: 'Unsupported API version',
          code: 'UNSUPPORTED_API_VERSION',
          supportedVersions
        });
        return;
      }

      // Add version to request for use in handlers
      (req as any).apiVersion = apiVersion;
      next();
    };
  }
}

export default RequestValidator;