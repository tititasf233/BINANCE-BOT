import { BaseError, ErrorSeverity } from './ErrorTypes';
import { logger } from '../utils/logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: BaseError) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: BaseError;
  attempts: number;
  totalTime: number;
}

export class RetryManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error: BaseError) => error.retryable,
  };

  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<T> {
    const finalConfig = { ...RetryManager.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: BaseError;
    let attempt = 0;

    while (attempt < finalConfig.maxAttempts) {
      attempt++;
      
      try {
        logger.debug({
          context,
          attempt,
          maxAttempts: finalConfig.maxAttempts,
        }, 'Executing operation with retry');

        const result = await operation();
        
        if (attempt > 1) {
          logger.info({
            context,
            attempt,
            totalTime: Date.now() - startTime,
          }, 'Operation succeeded after retry');
        }

        return result;
      } catch (error) {
        const baseError = error instanceof BaseError ? error : new BaseError({
          code: 'SYS_001' as any,
          message: error instanceof Error ? error.message : String(error),
          severity: ErrorSeverity.MEDIUM,
          retryable: true,
        });

        lastError = baseError;

        logger.warn({
          context,
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          error: baseError.toJSON(),
        }, 'Operation failed, checking retry conditions');

        // Check if we should retry
        const shouldRetry = finalConfig.retryCondition!(baseError) && attempt < finalConfig.maxAttempts;

        if (!shouldRetry) {
          logger.error({
            context,
            attempt,
            totalTime: Date.now() - startTime,
            error: baseError.toJSON(),
          }, 'Operation failed, no more retries');
          
          throw baseError;
        }

        // Calculate delay for next attempt
        if (attempt < finalConfig.maxAttempts) {
          const delay = RetryManager.calculateDelay(attempt, finalConfig);
          
          logger.info({
            context,
            attempt,
            nextAttemptIn: delay,
          }, 'Waiting before next retry attempt');

          await RetryManager.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  public static executeWithRetrySafe<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    
    return RetryManager.executeWithRetry(operation, config, context)
      .then((result) => ({
        success: true,
        result,
        attempts: 1, // This would need to be tracked properly
        totalTime: Date.now() - startTime,
      }))
      .catch((error) => ({
        success: false,
        error: error instanceof BaseError ? error : new BaseError({
          code: 'SYS_001' as any,
          message: error instanceof Error ? error.message : String(error),
          severity: ErrorSeverity.MEDIUM,
        }),
        attempts: config.maxAttempts || RetryManager.DEFAULT_CONFIG.maxAttempts,
        totalTime: Date.now() - startTime,
      }));
  }

  private static calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Predefined retry configurations for common scenarios
  public static readonly CONFIGS = {
    DATABASE: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error: BaseError) => 
        error.retryable && error.code.startsWith('DB_'),
    },

    EXTERNAL_API: {
      maxAttempts: 5,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryCondition: (error: BaseError) => 
        error.retryable && (
          error.code.startsWith('EXT_') || 
          error.code.startsWith('NET_')
        ),
    },

    BINANCE_API: {
      maxAttempts: 3,
      baseDelay: 5000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error: BaseError) => 
        error.retryable && 
        error.code.startsWith('EXT_') &&
        error.code !== 'EXT_003', // Don't retry rate limits immediately
    },

    TRADING_OPERATION: {
      maxAttempts: 2,
      baseDelay: 3000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: false, // No jitter for trading operations
      retryCondition: (error: BaseError) => 
        error.retryable && 
        !error.code.startsWith('TRD_'), // Most trading errors shouldn't be retried
    },

    SYSTEM_OPERATION: {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 20000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error: BaseError) => 
        error.retryable && error.severity !== ErrorSeverity.CRITICAL,
    },
  };
}

// Decorator for automatic retry
export function withRetry(config: Partial<RetryConfig> = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = `${target.constructor.name}.${propertyName}`;
      
      return RetryManager.executeWithRetry(
        () => method.apply(this, args),
        config,
        context
      );
    };

    return descriptor;
  };
}