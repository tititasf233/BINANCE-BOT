import { BaseError, SystemError, ErrorCode } from './ErrorTypes';
import { logger } from '../utils/logger';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // in milliseconds
  monitoringPeriod: number; // in milliseconds
  halfOpenMaxCalls: number;
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private halfOpenCalls: number = 0;

  constructor(private config: CircuitBreakerConfig) {
    logger.info({
      circuitBreaker: config.name,
      config,
    }, 'Circuit breaker initialized');
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.canExecute()) {
        const error = new SystemError(
          ErrorCode.SERVICE_UNAVAILABLE,
          `Circuit breaker is OPEN for ${this.config.name}`,
          undefined,
          {
            circuitBreaker: this.config.name,
            state: this.state,
            nextAttemptTime: this.nextAttemptTime,
          }
        );
        
        logger.warn({
          circuitBreaker: this.config.name,
          state: this.state,
          nextAttemptTime: this.nextAttemptTime,
        }, 'Circuit breaker rejected call');

        reject(error);
        return;
      }

      this.totalCalls++;
      
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenCalls++;
      }

      const startTime = Date.now();

      operation()
        .then((result) => {
          const duration = Date.now() - startTime;
          this.onSuccess(duration);
          resolve(result);
        })
        .catch((error) => {
          const duration = Date.now() - startTime;
          this.onFailure(error, duration);
          reject(error);
        });
    });
  }

  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime.getTime()) {
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenCalls = 0;
          
          logger.info({
            circuitBreaker: this.config.name,
          }, 'Circuit breaker transitioning to HALF_OPEN');
          
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  private onSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    logger.debug({
      circuitBreaker: this.config.name,
      state: this.state,
      duration,
      successCount: this.successCount,
    }, 'Circuit breaker operation succeeded');

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.reset();
        
        logger.info({
          circuitBreaker: this.config.name,
        }, 'Circuit breaker recovered, transitioning to CLOSED');
      }
    }
  }

  private onFailure(error: any, duration: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    logger.warn({
      circuitBreaker: this.config.name,
      state: this.state,
      duration,
      failureCount: this.failureCount,
      error: error instanceof BaseError ? error.toJSON() : { message: String(error) },
    }, 'Circuit breaker operation failed');

    if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.trip();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    logger.error({
      circuitBreaker: this.config.name,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      nextAttemptTime: this.nextAttemptTime,
    }, 'Circuit breaker OPENED due to failures');
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.nextAttemptTime = undefined;
  }

  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  public forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    logger.warn({
      circuitBreaker: this.config.name,
    }, 'Circuit breaker manually opened');
  }

  public forceClose(): void {
    this.reset();
    
    logger.info({
      circuitBreaker: this.config.name,
    }, 'Circuit breaker manually closed');
  }

  public forceClosed(): void {
    this.reset();
  }
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  public getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        halfOpenMaxCalls: 3,
        name,
      };

      const finalConfig = { ...defaultConfig, ...config };
      this.circuitBreakers.set(name, new CircuitBreaker(finalConfig));
    }

    return this.circuitBreakers.get(name)!;
  }

  public get(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  public getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, breaker] of this.circuitBreakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  public remove(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }

  // Predefined circuit breaker configurations
  public static readonly CONFIGS = {
    BINANCE_API: {
      failureThreshold: 3,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      halfOpenMaxCalls: 2,
    },

    DATABASE: {
      failureThreshold: 5,
      recoveryTimeout: 10000, // 10 seconds
      monitoringPeriod: 60000, // 1 minute
      halfOpenMaxCalls: 3,
    },

    EXTERNAL_SERVICE: {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      halfOpenMaxCalls: 3,
    },

    TRADING_ENGINE: {
      failureThreshold: 2,
      recoveryTimeout: 120000, // 2 minutes
      monitoringPeriod: 300000, // 5 minutes
      halfOpenMaxCalls: 1,
    },
  };
}

// Decorator for automatic circuit breaker
export function withCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const manager = CircuitBreakerManager.getInstance();
      const circuitBreaker = manager.getOrCreate(name, config);
      
      return circuitBreaker.execute(() => method.apply(this, args));
    };

    return descriptor;
  };
}