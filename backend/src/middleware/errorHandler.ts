import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    code = 'FORBIDDEN';
    message = 'Access denied';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    code = 'NOT_FOUND';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    code = 'CONFLICT';
  } else if (error.name === 'TooManyRequestsError') {
    statusCode = 429;
    code = 'TOO_MANY_REQUESTS';
  }

  // Handle database errors
  if (error.message.includes('duplicate key')) {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  } else if (error.message.includes('foreign key constraint')) {
    statusCode = 400;
    code = 'INVALID_REFERENCE';
    message = 'Invalid reference to related resource';
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    code = 'INTERNAL_ERROR';
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };

  // Include error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = error.details;
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error wrapper
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error classes
 */
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = 'FORBIDDEN';
  
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends Error {
  statusCode = 429;
  code = 'TOO_MANY_REQUESTS';
  
  constructor(message: string = 'Too many requests') {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.fatal('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};