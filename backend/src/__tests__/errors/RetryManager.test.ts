import { RetryManager } from '../../errors/RetryManager';
import { BaseError, ErrorCode, ErrorSeverity } from '../../errors/ErrorTypes';

describe('RetryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await RetryManager.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const retryableError = new BaseError({
        code: ErrorCode.DATABASE_CONNECTION_FAILED,
        message: 'Connection failed',
        severity: ErrorSeverity.HIGH,
        retryable: true,
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const result = await RetryManager.executeWithRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10, // Short delay for testing
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new BaseError({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
      });

      const operation = jest.fn().mockRejectedValue(nonRetryableError);

      await expect(
        RetryManager.executeWithRetry(operation, { maxAttempts: 3 })
      ).rejects.toThrow(nonRetryableError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect maxAttempts limit', async () => {
      const retryableError = new BaseError({
        code: ErrorCode.TIMEOUT,
        message: 'Timeout',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const operation = jest.fn().mockRejectedValue(retryableError);

      await expect(
        RetryManager.executeWithRetry(operation, {
          maxAttempts: 2,
          baseDelay: 10,
        })
      ).rejects.toThrow(retryableError);

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use custom retry condition', async () => {
      const error = new BaseError({
        code: ErrorCode.BINANCE_API_ERROR,
        message: 'API error',
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
      });

      const operation = jest.fn().mockRejectedValue(error);

      const customRetryCondition = jest.fn().mockReturnValue(false);

      await expect(
        RetryManager.executeWithRetry(operation, {
          maxAttempts: 3,
          retryCondition: customRetryCondition,
        })
      ).rejects.toThrow(error);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(customRetryCondition).toHaveBeenCalledWith(error);
    });
  });

  describe('executeWithRetrySafe', () => {
    it('should return success result', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await RetryManager.executeWithRetrySafe(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('should return failure result', async () => {
      const error = new BaseError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        severity: ErrorSeverity.LOW,
        retryable: false,
      });

      const operation = jest.fn().mockRejectedValue(error);

      const result = await RetryManager.executeWithRetrySafe(operation);

      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.error).toBe(error);
    });
  });

  describe('predefined configs', () => {
    it('should have DATABASE config', () => {
      const config = RetryManager.CONFIGS.DATABASE;

      expect(config.maxAttempts).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.retryCondition).toBeDefined();
    });

    it('should have EXTERNAL_API config', () => {
      const config = RetryManager.CONFIGS.EXTERNAL_API;

      expect(config.maxAttempts).toBe(5);
      expect(config.baseDelay).toBe(2000);
      expect(config.retryCondition).toBeDefined();
    });

    it('should have BINANCE_API config', () => {
      const config = RetryManager.CONFIGS.BINANCE_API;

      expect(config.maxAttempts).toBe(3);
      expect(config.baseDelay).toBe(5000);
      expect(config.retryCondition).toBeDefined();
    });
  });
});