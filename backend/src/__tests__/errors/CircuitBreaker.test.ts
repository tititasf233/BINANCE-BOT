import { CircuitBreaker, CircuitState, CircuitBreakerManager } from '../../errors/CircuitBreaker';
import { BaseError, ErrorCode, ErrorSeverity } from '../../errors/ErrorTypes';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      name: 'test-circuit',
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      halfOpenMaxCalls: 2,
    });
  });

  describe('execute', () => {
    it('should execute operation when circuit is closed', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should open circuit after failure threshold', async () => {
      const error = new BaseError({
        code: ErrorCode.EXTERNAL_API_ERROR,
        message: 'API error',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const operation = jest.fn().mockRejectedValue(error);

      // Execute operations to reach failure threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected to fail
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failureCount).toBe(3);
    });

    it('should reject calls when circuit is open', async () => {
      const error = new BaseError({
        code: ErrorCode.EXTERNAL_API_ERROR,
        message: 'API error',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const operation = jest.fn().mockRejectedValue(error);

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected to fail
        }
      }

      // Now the circuit should be open and reject calls
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to half-open after recovery timeout', async () => {
      const error = new BaseError({
        code: ErrorCode.EXTERNAL_API_ERROR,
        message: 'API error',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const operation = jest.fn().mockRejectedValue(error);

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected to fail
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should transition to half-open
      const successOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('success');
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after successful half-open calls', async () => {
      const error = new BaseError({
        code: ErrorCode.EXTERNAL_API_ERROR,
        message: 'API error',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const failingOperation = jest.fn().mockRejectedValue(error);
      const successOperation = jest.fn().mockResolvedValue('success');

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (e) {
          // Expected to fail
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful operations in half-open state
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const stats = circuitBreaker.getStats();

      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('manual control', () => {
    it('should allow manual opening', () => {
      circuitBreaker.forceOpen();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
    });

    it('should allow manual closing', async () => {
      const error = new BaseError({
        code: ErrorCode.EXTERNAL_API_ERROR,
        message: 'API error',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const operation = jest.fn().mockRejectedValue(error);

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected to fail
        }
      }

      circuitBreaker.forceClose();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = CircuitBreakerManager.getInstance();
  });

  describe('getOrCreate', () => {
    it('should create new circuit breaker', () => {
      const circuitBreaker = manager.getOrCreate('test-service');

      expect(circuitBreaker).toBeDefined();
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should return existing circuit breaker', () => {
      const circuitBreaker1 = manager.getOrCreate('test-service');
      const circuitBreaker2 = manager.getOrCreate('test-service');

      expect(circuitBreaker1).toBe(circuitBreaker2);
    });

    it('should use custom config', () => {
      const customConfig = {
        failureThreshold: 10,
        recoveryTimeout: 5000,
      };

      const circuitBreaker = manager.getOrCreate('custom-service', customConfig);

      expect(circuitBreaker).toBeDefined();
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all circuit breakers', () => {
      manager.getOrCreate('service1');
      manager.getOrCreate('service2');

      const allStats = manager.getAllStats();

      expect(Object.keys(allStats)).toContain('service1');
      expect(Object.keys(allStats)).toContain('service2');
    });
  });

  describe('remove', () => {
    it('should remove circuit breaker', () => {
      manager.getOrCreate('test-service');
      
      const removed = manager.remove('test-service');
      
      expect(removed).toBe(true);
      expect(manager.get('test-service')).toBeUndefined();
    });

    it('should return false for non-existent circuit breaker', () => {
      const removed = manager.remove('non-existent');
      
      expect(removed).toBe(false);
    });
  });
});