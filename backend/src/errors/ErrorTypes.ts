export enum ErrorCode {
  // Authentication Errors (1000-1099)
  INVALID_CREDENTIALS = 'AUTH_001',
  TOKEN_EXPIRED = 'AUTH_002',
  TOKEN_INVALID = 'AUTH_003',
  UNAUTHORIZED = 'AUTH_004',
  FORBIDDEN = 'AUTH_005',
  
  // Validation Errors (1100-1199)
  VALIDATION_FAILED = 'VAL_001',
  INVALID_INPUT = 'VAL_002',
  MISSING_REQUIRED_FIELD = 'VAL_003',
  INVALID_FORMAT = 'VAL_004',
  
  // Database Errors (1200-1299)
  DATABASE_CONNECTION_FAILED = 'DB_001',
  QUERY_FAILED = 'DB_002',
  RECORD_NOT_FOUND = 'DB_003',
  DUPLICATE_RECORD = 'DB_004',
  CONSTRAINT_VIOLATION = 'DB_005',
  
  // External API Errors (1300-1399)
  BINANCE_API_ERROR = 'EXT_001',
  BINANCE_CONNECTION_FAILED = 'EXT_002',
  BINANCE_RATE_LIMIT = 'EXT_003',
  BINANCE_INVALID_SYMBOL = 'EXT_004',
  BINANCE_INSUFFICIENT_BALANCE = 'EXT_005',
  
  // Trading Errors (1400-1499)
  STRATEGY_NOT_FOUND = 'TRD_001',
  STRATEGY_EXECUTION_FAILED = 'TRD_002',
  INVALID_ORDER = 'TRD_003',
  ORDER_EXECUTION_FAILED = 'TRD_004',
  INSUFFICIENT_FUNDS = 'TRD_005',
  MARKET_CLOSED = 'TRD_006',
  POSITION_NOT_FOUND = 'TRD_007',
  
  // System Errors (1500-1599)
  INTERNAL_SERVER_ERROR = 'SYS_001',
  SERVICE_UNAVAILABLE = 'SYS_002',
  TIMEOUT = 'SYS_003',
  RATE_LIMIT_EXCEEDED = 'SYS_004',
  MAINTENANCE_MODE = 'SYS_005',
  
  // Configuration Errors (1600-1699)
  INVALID_CONFIGURATION = 'CFG_001',
  MISSING_ENVIRONMENT_VARIABLE = 'CFG_002',
  INVALID_STRATEGY_PARAMETERS = 'CFG_003',
  
  // File/Data Errors (1700-1799)
  FILE_NOT_FOUND = 'FILE_001',
  FILE_READ_ERROR = 'FILE_002',
  FILE_WRITE_ERROR = 'FILE_003',
  INVALID_FILE_FORMAT = 'FILE_004',
  
  // Network Errors (1800-1899)
  NETWORK_ERROR = 'NET_001',
  CONNECTION_TIMEOUT = 'NET_002',
  DNS_RESOLUTION_FAILED = 'NET_003',
  
  // Business Logic Errors (1900-1999)
  BUSINESS_RULE_VIOLATION = 'BIZ_001',
  INVALID_OPERATION = 'BIZ_002',
  OPERATION_NOT_ALLOWED = 'BIZ_003',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  userId?: string;
  strategyId?: string;
  orderId?: string;
  symbol?: string;
  requestId?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  context?: ErrorContext;
  originalError?: Error;
  stack?: string;
  retryable?: boolean;
  userMessage?: string;
}

export class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context?: ErrorContext;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  public readonly userMessage?: string;
  public readonly timestamp: Date;

  constructor(details: ErrorDetails) {
    super(details.message);
    
    this.name = this.constructor.name;
    this.code = details.code;
    this.severity = details.severity;
    this.context = details.context;
    this.originalError = details.originalError;
    this.retryable = details.retryable || false;
    this.userMessage = details.userMessage;
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Specific Error Classes
export class AuthenticationError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super({
      code,
      message,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: false,
      userMessage: 'Authentication failed. Please check your credentials.',
    });
  }
}

export class ValidationError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super({
      code,
      message,
      severity: ErrorSeverity.LOW,
      context,
      retryable: false,
      userMessage: 'Invalid input provided. Please check your data.',
    });
  }
}

export class DatabaseError extends BaseError {
  constructor(code: ErrorCode, message: string, originalError?: Error, context?: ErrorContext) {
    super({
      code,
      message,
      severity: ErrorSeverity.HIGH,
      context,
      originalError,
      retryable: true,
      userMessage: 'Database operation failed. Please try again.',
    });
  }
}

export class ExternalAPIError extends BaseError {
  constructor(code: ErrorCode, message: string, originalError?: Error, context?: ErrorContext) {
    super({
      code,
      message,
      severity: ErrorSeverity.MEDIUM,
      context,
      originalError,
      retryable: true,
      userMessage: 'External service temporarily unavailable. Please try again.',
    });
  }
}

export class TradingError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super({
      code,
      message,
      severity: ErrorSeverity.HIGH,
      context,
      retryable: false,
      userMessage: 'Trading operation failed. Please check your settings.',
    });
  }
}

export class SystemError extends BaseError {
  constructor(code: ErrorCode, message: string, originalError?: Error, context?: ErrorContext) {
    super({
      code,
      message,
      severity: ErrorSeverity.CRITICAL,
      context,
      originalError,
      retryable: true,
      userMessage: 'System error occurred. Our team has been notified.',
    });
  }
}