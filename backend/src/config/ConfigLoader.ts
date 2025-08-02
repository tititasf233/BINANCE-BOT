import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
}

export interface BinanceConfig {
  baseUrl: string;
  testnetUrl: string;
  useTestnet: boolean;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  encryptionKey: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  trustProxy: boolean;
  requestTimeout: number;
}

export interface LoggingConfig {
  level: string;
  file?: string;
  maxFiles?: number;
  maxSize?: string;
  format: 'json' | 'simple';
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  healthCheckInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
  };
}

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    alertEmails: string[];
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    username: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    timeout: number;
    retries: number;
  };
}

export interface AppConfig {
  environment: string;
  version: string;
  name: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  binance: BinanceConfig;
  security: SecurityConfig;
  server: ServerConfig;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  notifications: NotificationConfig;
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig | null = null;
  private environment: string = 'development';

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  loadConfig(environment?: string): AppConfig {
    if (this.config) {
      return this.config;
    }

    const env = environment || process.env.NODE_ENV || 'development';
    this.environment = env;
    
    try {
      // Load base configuration from YAML file
      const configPath = path.join(process.cwd(), 'config', 'environments', `${env}.yml`);
      
      let baseConfig: Partial<AppConfig> = {};
      
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf8');
        baseConfig = yaml.load(configFile) as Partial<AppConfig>;
        logger.info(`Loaded configuration from ${configPath}`);
      } else {
        logger.warn(`Configuration file not found: ${configPath}, using environment variables only`);
      }

      // Override with environment variables
      this.config = this.mergeWithEnvironmentVariables(baseConfig, env);
      
      // Validate configuration
      this.validateConfig(this.config);
      
      logger.info(`Configuration loaded successfully for environment: ${env}`);
      return this.config;
      
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  private mergeWithEnvironmentVariables(baseConfig: Partial<AppConfig>, environment: string): AppConfig {
    return {
      environment,
      version: process.env.APP_VERSION || baseConfig.version || '1.0.0',
      name: process.env.APP_NAME || baseConfig.name || 'Sistema AURA',
      
      database: {
        host: process.env.DB_HOST || baseConfig.database?.host || 'localhost',
        port: parseInt(process.env.DB_PORT || '') || baseConfig.database?.port || 5432,
        database: process.env.DB_NAME || baseConfig.database?.database || 'aura_trading',
        username: process.env.DB_USER || baseConfig.database?.username || 'postgres',
        password: process.env.DB_PASSWORD || baseConfig.database?.password || 'password',
        ssl: process.env.DB_SSL === 'true' || baseConfig.database?.ssl || false,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '') || baseConfig.database?.maxConnections || 20,
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '') || baseConfig.database?.idleTimeoutMillis || 30000,
      },
      
      redis: {
        host: process.env.REDIS_HOST || baseConfig.redis?.host || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '') || baseConfig.redis?.port || 6379,
        password: process.env.REDIS_PASSWORD || baseConfig.redis?.password,
        database: parseInt(process.env.REDIS_DB || '') || baseConfig.redis?.database || 0,
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '') || baseConfig.redis?.maxRetriesPerRequest || 3,
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '') || baseConfig.redis?.retryDelayOnFailover || 100,
      },
      
      binance: {
        baseUrl: process.env.BINANCE_BASE_URL || baseConfig.binance?.baseUrl || 'https://api.binance.com',
        testnetUrl: process.env.BINANCE_TESTNET_URL || baseConfig.binance?.testnetUrl || 'https://testnet.binance.vision',
        useTestnet: process.env.BINANCE_USE_TESTNET === 'true' || baseConfig.binance?.useTestnet || false,
        timeout: parseInt(process.env.BINANCE_TIMEOUT || '') || baseConfig.binance?.timeout || 10000,
        maxRetries: parseInt(process.env.BINANCE_MAX_RETRIES || '') || baseConfig.binance?.maxRetries || 3,
        retryDelay: parseInt(process.env.BINANCE_RETRY_DELAY || '') || baseConfig.binance?.retryDelay || 1000,
      },
      
      security: {
        jwtSecret: process.env.JWT_SECRET || baseConfig.security?.jwtSecret || 'your-super-secret-jwt-key',
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || baseConfig.security?.jwtRefreshSecret || 'your-super-secret-refresh-key',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || baseConfig.security?.jwtExpiresIn || '1h',
        jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || baseConfig.security?.jwtRefreshExpiresIn || '7d',
        encryptionKey: process.env.ENCRYPTION_KEY || baseConfig.security?.encryptionKey || 'your-32-character-encryption-key',
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '') || baseConfig.security?.rateLimitWindowMs || 900000,
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '') || baseConfig.security?.rateLimitMaxRequests || 100,
      },
      
      server: {
        port: parseInt(process.env.PORT || '') || baseConfig.server?.port || 8000,
        host: process.env.HOST || baseConfig.server?.host || 'localhost',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || baseConfig.server?.corsOrigins || ['http://localhost:3000'],
        trustProxy: process.env.TRUST_PROXY === 'true' || baseConfig.server?.trustProxy || false,
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '') || baseConfig.server?.requestTimeout || 30000,
      },
      
      logging: {
        level: process.env.LOG_LEVEL || baseConfig.logging?.level || 'info',
        file: process.env.LOG_FILE || baseConfig.logging?.file,
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '') || baseConfig.logging?.maxFiles || 5,
        maxSize: process.env.LOG_MAX_SIZE || baseConfig.logging?.maxSize || '10m',
        format: (process.env.LOG_FORMAT as 'json' | 'simple') || baseConfig.logging?.format || 'json',
      },
      
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false' && (baseConfig.monitoring?.enabled !== false),
        metricsInterval: parseInt(process.env.METRICS_INTERVAL || '') || baseConfig.monitoring?.metricsInterval || 60000,
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '') || baseConfig.monitoring?.healthCheckInterval || 30000,
        alertThresholds: {
          cpuUsage: parseFloat(process.env.ALERT_CPU_THRESHOLD || '') || baseConfig.monitoring?.alertThresholds?.cpuUsage || 80,
          memoryUsage: parseFloat(process.env.ALERT_MEMORY_THRESHOLD || '') || baseConfig.monitoring?.alertThresholds?.memoryUsage || 85,
          responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '') || baseConfig.monitoring?.alertThresholds?.responseTime || 5000,
          errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || '') || baseConfig.monitoring?.alertThresholds?.errorRate || 5,
        },
      },
      
      notifications: {
        email: {
          enabled: process.env.EMAIL_ENABLED === 'true' || baseConfig.notifications?.email?.enabled || false,
          smtp: {
            host: process.env.SMTP_HOST || baseConfig.notifications?.email?.smtp?.host || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '') || baseConfig.notifications?.email?.smtp?.port || 587,
            secure: process.env.SMTP_SECURE === 'true' || baseConfig.notifications?.email?.smtp?.secure || false,
            auth: {
              user: process.env.SMTP_USER || baseConfig.notifications?.email?.smtp?.auth?.user || '',
              pass: process.env.SMTP_PASSWORD || baseConfig.notifications?.email?.smtp?.auth?.pass || '',
            },
          },
          from: process.env.FROM_EMAIL || baseConfig.notifications?.email?.from || 'noreply@aura-trading.com',
          alertEmails: process.env.ALERT_EMAILS?.split(',') || baseConfig.notifications?.email?.alertEmails || [],
        },
        slack: {
          enabled: process.env.SLACK_ENABLED === 'true' || baseConfig.notifications?.slack?.enabled || false,
          webhookUrl: process.env.SLACK_WEBHOOK_URL || baseConfig.notifications?.slack?.webhookUrl || '',
          channel: process.env.SLACK_CHANNEL || baseConfig.notifications?.slack?.channel || '#alerts',
          username: process.env.SLACK_USERNAME || baseConfig.notifications?.slack?.username || 'AURA Bot',
        },
        webhook: {
          enabled: process.env.WEBHOOK_ENABLED === 'true' || baseConfig.notifications?.webhook?.enabled || false,
          url: process.env.WEBHOOK_URL || baseConfig.notifications?.webhook?.url || '',
          timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '') || baseConfig.notifications?.webhook?.timeout || 5000,
          retries: parseInt(process.env.WEBHOOK_RETRIES || '') || baseConfig.notifications?.webhook?.retries || 3,
        },
      },
    };
  }

  private validateConfig(config: AppConfig): void {
    const requiredFields = [
      'security.jwtSecret',
      'security.encryptionKey',
      'database.host',
      'database.database',
      'database.username',
      'redis.host'
    ];

    for (const field of requiredFields) {
      if (!this.getNestedValue(config, field)) {
        throw new Error(`Required configuration field missing: ${field}`);
      }
    }

    // Validações específicas
    if (config.server.port < 1 || config.server.port > 65535) {
      throw new Error('Server port must be between 1 and 65535');
    }

    if (config.database.maxConnections && config.database.maxConnections < 1) {
      throw new Error('Invalid database max connections');
    }

    if (config.security.encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }

    logger.info('Configuration validation passed');
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  getEnvironment(): string {
    return this.environment;
  }

  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  isProduction(): boolean {
    return this.environment === 'production';
  }

  isTest(): boolean {
    return this.environment === 'test';
  }

  isStaging(): boolean {
    return this.environment === 'staging';
  }

  // Métodos de conveniência para acessar configurações específicas
  getDatabaseConfig(): DatabaseConfig {
    return this.getConfig().database;
  }

  getRedisConfig(): RedisConfig {
    return this.getConfig().redis;
  }

  getBinanceConfig(): BinanceConfig {
    return this.getConfig().binance;
  }

  getServerConfig(): ServerConfig {
    return this.getConfig().server;
  }

  getSecurityConfig(): SecurityConfig {
    return this.getConfig().security;
  }

  getLoggingConfig(): LoggingConfig {
    return this.getConfig().logging;
  }

  getMonitoringConfig(): MonitoringConfig {
    return this.getConfig().monitoring;
  }

  getNotificationConfig(): NotificationConfig {
    return this.getConfig().notifications;
  }
}