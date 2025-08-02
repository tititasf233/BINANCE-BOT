import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log levels with trace added
const levels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// Define colors for each level
const colors = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'gray',
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, userId, tradeId, strategyId, symbol, ...meta }: any) => {
    let contextInfo = '';
    if (userId) contextInfo += `[User:${userId}]`;
    if (tradeId) contextInfo += `[Trade:${tradeId}]`;
    if (strategyId) contextInfo += `[Strategy:${strategyId}]`;
    if (symbol) contextInfo += `[${symbol}]`;
    
    let metaStr = '';
    const filteredMeta = { ...meta };
    delete filteredMeta.service;
    if (Object.keys(filteredMeta).length > 0) {
      metaStr = ` ${JSON.stringify(filteredMeta)}`;
    }
    
    return `${timestamp} [${level}]: ${contextInfo} ${message}${metaStr}`;
  })
);

// Custom format for structured JSON file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info: any) => {
    const { timestamp, level, message, service, userId, tradeId, strategyId, symbol, ...meta } = info;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || 'aura-trading',
      message,
      ...(userId && { userId }),
      ...(tradeId && { tradeId }),
      ...(strategyId && { strategyId }),
      ...(symbol && { symbol }),
      ...meta
    };

    return JSON.stringify(logEntry);
  })
);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger instance
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'aura-trading' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
    }),
    
    // Trading specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'trading.log'),
      level: 'info',
      format: fileFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 7,
    }),
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat,
    }),
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat,
    }),
  ],
});

// Enhanced logger with context methods
class ContextLogger {
  private baseLogger: winston.Logger;
  private context: Record<string, any>;

  constructor(baseLogger: winston.Logger, context: Record<string, any> = {}) {
    this.baseLogger = baseLogger;
    this.context = context;
  }

  private log(level: string, message: string, meta: Record<string, any> = {}) {
    this.baseLogger.log(level, message, { ...this.context, ...meta });
  }

  fatal(message: string, meta?: Record<string, any>) {
    this.log('fatal', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  trace(message: string, meta?: Record<string, any>) {
    this.log('trace', message, meta);
  }

  // Trading specific log methods
  tradeExecuted(tradeData: any) {
    this.info('Trade executed', {
      type: 'TRADE_EXECUTED',
      trade: tradeData,
      timestamp: new Date().toISOString()
    });
  }

  strategySignal(strategyId: string, symbol: string, signal: any) {
    this.info('Strategy signal generated', {
      type: 'STRATEGY_SIGNAL',
      strategyId,
      symbol,
      signal,
      timestamp: new Date().toISOString()
    });
  }

  marketDataReceived(symbol: string, data: any) {
    this.debug('Market data received', {
      type: 'MARKET_DATA',
      symbol,
      data,
      timestamp: new Date().toISOString()
    });
  }

  apiError(endpoint: string, error: any) {
    this.error('API error occurred', {
      type: 'API_ERROR',
      endpoint,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  performanceMetric(metric: string, value: number, unit: string = 'ms') {
    this.info('Performance metric', {
      type: 'PERFORMANCE_METRIC',
      metric,
      value,
      unit,
      timestamp: new Date().toISOString()
    });
  }

  // Create child logger with additional context
  child(additionalContext: Record<string, any>): ContextLogger {
    return new ContextLogger(this.baseLogger, { ...this.context, ...additionalContext });
  }
}

// Export default logger instance
const defaultLogger = new ContextLogger(logger);

export { ContextLogger, defaultLogger as logger };
export default defaultLogger;