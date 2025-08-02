import { Pool } from 'pg';
import Redis from 'ioredis';
import { DatabaseConnection } from '../../database/connection';
import { RedisService } from '../../services/RedisService';
import { logger } from '../../utils/logger';

export class IntegrationTestSetup {
  private static instance: IntegrationTestSetup;
  private dbPool: Pool | null = null;
  private redisClient: Redis | null = null;

  static getInstance(): IntegrationTestSetup {
    if (!IntegrationTestSetup.instance) {
      IntegrationTestSetup.instance = new IntegrationTestSetup();
    }
    return IntegrationTestSetup.instance;
  }

  async setupDatabase(): Promise<void> {
    try {
      // Use test database configuration
      const testDbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME + '_test' || 'aura_trading_test',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
      };

      this.dbPool = new Pool(testDbConfig);
      
      // Test connection
      const client = await this.dbPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Integration test database connected successfully');
    } catch (error) {
      logger.error('Failed to setup test database:', error);
      throw error;
    }
  }

  async setupRedis(): Promise<void> {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 15, // Use database 15 for tests
      };

      this.redisClient = new Redis(redisConfig);
      
      // Test connection
      await this.redisClient.ping();
      
      logger.info('Integration test Redis connected successfully');
    } catch (error) {
      logger.error('Failed to setup test Redis:', error);
      throw error;
    }
  }

  async cleanDatabase(): Promise<void> {
    if (!this.dbPool) return;

    try {
      const client = await this.dbPool.connect();
      
      // Clean all tables in reverse order of dependencies
      await client.query('TRUNCATE TABLE system_logs CASCADE');
      await client.query('TRUNCATE TABLE backtest_results CASCADE');
      await client.query('TRUNCATE TABLE trades CASCADE');
      await client.query('TRUNCATE TABLE strategies CASCADE');
      await client.query('TRUNCATE TABLE user_api_keys CASCADE');
      await client.query('TRUNCATE TABLE users CASCADE');
      
      // Reset sequences
      await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE strategies_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE trades_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE backtest_results_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE system_logs_id_seq RESTART WITH 1');
      
      client.release();
      logger.info('Test database cleaned successfully');
    } catch (error) {
      logger.error('Failed to clean test database:', error);
      throw error;
    }
  }

  async cleanRedis(): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.flushdb();
      logger.info('Test Redis cleaned successfully');
    } catch (error) {
      logger.error('Failed to clean test Redis:', error);
      throw error;
    }
  }

  async teardown(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = null;
      }
      
      if (this.dbPool) {
        await this.dbPool.end();
        this.dbPool = null;
      }
      
      logger.info('Integration test teardown completed');
    } catch (error) {
      logger.error('Failed to teardown integration tests:', error);
      throw error;
    }
  }

  getDbPool(): Pool {
    if (!this.dbPool) {
      throw new Error('Database not initialized. Call setupDatabase() first.');
    }
    return this.dbPool;
  }

  getRedisClient(): Redis {
    if (!this.redisClient) {
      throw new Error('Redis not initialized. Call setupRedis() first.');
    }
    return this.redisClient;
  }
}

// Global setup and teardown for Jest
export const setupIntegrationTests = async (): Promise<void> => {
  const setup = IntegrationTestSetup.getInstance();
  await setup.setupDatabase();
  await setup.setupRedis();
};

export const teardownIntegrationTests = async (): Promise<void> => {
  const setup = IntegrationTestSetup.getInstance();
  await setup.teardown();
};

export const cleanupBetweenTests = async (): Promise<void> => {
  const setup = IntegrationTestSetup.getInstance();
  await setup.cleanDatabase();
  await setup.cleanRedis();
};