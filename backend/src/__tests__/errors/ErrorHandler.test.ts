import { Request, Response } from 'express';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { BaseError, ErrorCode, ErrorSeverity, AuthenticationError } from '../../errors/ErrorTypes';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    
    mockRequest = {
      headers: { 'x-request-id': 'test-request-id' },
      user: { id: 'test-user-id' },
      url: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('handleError', () => {
    it('should handle BaseError instances correctly', () => {
      const originalError = new AuthenticationError(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials provided'
      );

      const result = errorHandler.handleError(originalError, mockRequest as Request);

      expect(result).toBe(originalError);
      expect(result.code).toBe(ErrorCode.INVALID_CREDENTIALS);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should convert unknown errors to SystemError', () => {
      const originalError = new Error('Unknown error');

      const result = errorHandler.handleError(originalError, mockRequest as Request);

      expect(result).toBeInstanceOf(BaseError);
      expect(result.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.originalError).toBe(originalError);
    });

    it('should include request context in error', () => {
      const originalError = new Error('Test error');

      const result = errorHandler.handleError(originalError, mockRequest as Request);

      expect(result.context).toMatchObject({
        requestId: 'test-request-id',
        userId: 'test-user-id',
        additionalData: {
          url: '/test',
          method: 'GET',
        },
      });
    });
  });

  describe('expressErrorHandler', () => {
    it('should send appropriate error response', () => {
      const error = new AuthenticationError(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials'
      );

      errorHandler.expressErrorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.INVALID_CREDENTIALS,
            message: 'Authentication failed. Please check your credentials.',
          }),
        })
      );
    });

    it('should include debug information in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new AuthenticationError(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials'
      );

      errorHandler.expressErrorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        jest.fn()
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: 'Invalid credentials',
            stack: expect.any(String),
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('handleAsyncError', () => {
    it('should handle successful async operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await errorHandler.handleAsyncError(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle async operation failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Async error'));

      await expect(errorHandler.handleAsyncError(operation)).rejects.toThrow();
    });
  });

  describe('handleSyncError', () => {
    it('should handle successful sync operations', () => {
      const operation = jest.fn().mockReturnValue('success');

      const result = errorHandler.handleSyncError(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle sync operation failures', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      expect(() => errorHandler.handleSyncError(operation)).toThrow();
    });
  });
});