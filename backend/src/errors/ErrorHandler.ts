import { Request, Response, NextFunction } from 'express';
import { BaseError, ErrorCode, ErrorSeverity, SystemError } from './ErrorTypes';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';
import { ErrorReporter } from './ErrorReporter';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private notificationService: NotificationService;
  private errorReporter: ErrorReporter;

  private constructor() {
    this.notificationService = new NotificationService();
    this.errorReporter = new ErrorReporter();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(error: Error, req?: Request): BaseError {
    let processedError: BaseError;

    if (error instanceof BaseError) {
      processedError = error;
    } else {
      // Convert unknown errors to SystemError
      processedError = new SystemError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        error.message || 'Unknown error occurred',
        error,
        {
          requestId: req?.headers['x-request-id'] as string,
          userId: req?.user?.id,
          timestamp: new Date(),
          additionalData: {
            url: req?.url,
            method: req?.method,
            userAgent: req?.headers['user-agent'],
          },
        }
      );
    }

    // Log the error
    this.logError(processedError, req);

    // Report critical errors
    if (processedError.severity === ErrorSeverity.CRITICAL) {
      this.errorReporter.reportError(processedError);
    }

    // Send notifications for high severity errors
    if (processedError.severity === ErrorSeverity.HIGH || processedError.severity === ErrorSeverity.CRITICAL) {
      this.notificationService.notifyError(processedError);
    }

    return processedError;
  }

  public expressErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const processedError = this.handleError(error, req);

    // Don't send error details in production for security
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const errorResponse = {
      success: false,
      error: {
        code: processedError.code,
        message: processedError.userMessage || 'An error occurred',
        ...(isDevelopment && {
          details: processedError.message,
          stack: processedError.stack,
          context: processedError.context,
        }),
      },
      timestamp: processedError.timestamp,
      requestId: req.headers['x-request-id'],
    };

    // Set appropriate HTTP status code
    const statusCode = this.getHttpStatusCode(processedError.code);
    res.status(statusCode).json(errorResponse);
  };

  private logError(error: BaseError, req?: Request): void {
    const logData = {
      error: error.toJSON(),
      request: req ? {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      } : undefined,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.fatal(logData, `Critical error: ${error.message}`);
        break;
      case ErrorSeverity.HIGH:
        logger.error(logData, `High severity error: ${error.message}`);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(logData, `Medium severity error: ${error.message}`);
        break;
      case ErrorSeverity.LOW:
        logger.info(logData, `Low severity error: ${error.message}`);
        break;
      default:
        logger.error(logData, `Unknown severity error: ${error.message}`);
    }
  }

  private getHttpStatusCode(errorCode: ErrorCode): number {
    const statusMap: Record<string, number> = {
      // Authentication errors
      [ErrorCode.INVALID_CREDENTIALS]: 401,
      [ErrorCode.TOKEN_EXPIRED]: 401,
      [ErrorCode.TOKEN_INVALID]: 401,
      [ErrorCode.UNAUTHORIZED]: 401,
      [ErrorCode.FORBIDDEN]: 403,

      // Validation errors
      [ErrorCode.VALIDATION_FAILED]: 400,
      [ErrorCode.INVALID_INPUT]: 400,
      [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
      [ErrorCode.INVALID_FORMAT]: 400,

      // Database errors
      [ErrorCode.RECORD_NOT_FOUND]: 404,
      [ErrorCode.DUPLICATE_RECORD]: 409,
      [ErrorCode.CONSTRAINT_VIOLATION]: 409,

      // External API errors
      [ErrorCode.BINANCE_RATE_LIMIT]: 429,
      [ErrorCode.BINANCE_INSUFFICIENT_BALANCE]: 400,

      // Trading errors
      [ErrorCode.STRATEGY_NOT_FOUND]: 404,
      [ErrorCode.INSUFFICIENT_FUNDS]: 400,
      [ErrorCode.INVALID_ORDER]: 400,

      // System errors
      [ErrorCode.SERVICE_UNAVAILABLE]: 503,
      [ErrorCode.TIMEOUT]: 408,
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorCode.MAINTENANCE_MODE]: 503,

      // File errors
      [ErrorCode.FILE_NOT_FOUND]: 404,

      // Business logic errors
      [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
      [ErrorCode.INVALID_OPERATION]: 422,
      [ErrorCode.OPERATION_NOT_ALLOWED]: 403,
    };

    return statusMap[errorCode] || 500;
  }

  public async handleAsyncError<T>(
    operation: () => Promise<T>,
    context?: any
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.handleError(error as Error, context);
    }
  }

  public handleSyncError<T>(
    operation: () => T,
    context?: any
  ): T {
    try {
      return operation();
    } catch (error) {
      throw this.handleError(error as Error, context);
    }
  }
}

// Global error handlers
export const setupGlobalErrorHandlers = (): void => {
  const errorHandler = ErrorHandler.getInstance();

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error }, 'Uncaught Exception');
    errorHandler.handleError(error);
    
    // Give time for logging and notifications
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.fatal({ reason, promise }, 'Unhandled Promise Rejection');
    
    const error = reason instanceof Error ? reason : new Error(String(reason));
    errorHandler.handleError(error);
  });

  // Handle SIGTERM gracefully
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};

export const errorHandler = ErrorHandler.getInstance();