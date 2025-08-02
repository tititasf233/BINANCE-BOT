import { Pool, PoolClient } from 'pg';
import { logger } from '@/utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

class DatabaseConnection {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'aura_db',
      user: process.env.DB_USER || 'aura_user',
      password: process.env.DB_PASSWORD || 'aura_password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };

    this.pool = new Pool(this.config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (_client: PoolClient) => {
      logger.info('New database client connected');
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('remove', () => {
      logger.info('Database client removed from pool');
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: result.rowCount });
      return result.rows;
    } catch (error) {
      logger.error('Database query error:', { text, params, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  getPoolInfo() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

export const db = new DatabaseConnection();
export default db;