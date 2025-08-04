import Redis from 'redis';
import { logger } from '@/utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export class RedisService {
  private client: Redis.RedisClientType;
  private publisher: Redis.RedisClientType;
  private subscriber: Redis.RedisClientType;
  private isConnected = false;

  constructor(config?: Partial<RedisConfig>) {
    const redisConfig = {
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config?.password || process.env.REDIS_PASSWORD,
      database: config?.db || 0,
      retryDelayOnFailover: config?.retryDelayOnFailover || 100,
      maxRetriesPerRequest: config?.maxRetriesPerRequest || 3
    };

    // Main client for general operations
    this.client = Redis.createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      password: redisConfig.password,
      database: redisConfig.database,
    });

    // Publisher client for pub/sub
    this.publisher = Redis.createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      password: redisConfig.password,
      database: redisConfig.database,
    });

    // Subscriber client for pub/sub
    this.subscriber = Redis.createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      password: redisConfig.password,
      database: redisConfig.database,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client connection ended');
      this.isConnected = false;
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', error);
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect()
      ]);

      logger.info('All Redis clients connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.publisher.quit(),
        this.subscriber.quit()
      ]);

      logger.info('All Redis clients disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: string | object, expirationSeconds?: number): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (expirationSeconds) {
        await this.client.setEx(key, expirationSeconds, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      throw error;
    }
  }

  /**
   * Get a value by key
   */
  async get<T = string>(key: string, parseJson = false): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        return null;
      }

      if (parseJson) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      throw error;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', { key, error });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error });
      throw error;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, seconds, error });
      throw error;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = string>(keys: string[], parseJson = false): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      
      return values.map(value => {
        if (value === null) {
          return null;
        }

        if (parseJson) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return value as T;
          }
        }

        return value as T;
      });
    } catch (error) {
      logger.error('Redis MGET error:', { keys, error });
      throw error;
    }
  }

  /**
   * Hash operations
   */
  async hset(key: string, field: string, value: string | object): Promise<number> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.hSet(key, field, stringValue);
    } catch (error) {
      logger.error('Redis HSET error:', { key, field, error });
      throw error;
    }
  }

  async hget<T = string>(key: string, field: string, parseJson = false): Promise<T | null> {
    try {
      const value = await this.client.hGet(key, field);
      
      if (value === null) {
        return null;
      }

      if (parseJson) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;
    } catch (error) {
      logger.error('Redis HGET error:', { key, field, error });
      throw error;
    }
  }

  async hgetall<T = Record<string, string>>(key: string, parseJson = false): Promise<T | null> {
    try {
      const hash = await this.client.hGetAll(key);
      
      if (Object.keys(hash).length === 0) {
        return null;
      }

      if (parseJson) {
        const parsed: any = {};
        for (const [field, value] of Object.entries(hash)) {
          try {
            parsed[field] = JSON.parse(value);
          } catch {
            parsed[field] = value;
          }
        }
        return parsed as T;
      }

      return hash as T;
    } catch (error) {
      logger.error('Redis HGETALL error:', { key, error });
      throw error;
    }
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: (string | object)[]): Promise<number> {
    try {
      const stringValues = values.map(v => typeof v === 'string' ? v : JSON.stringify(v));
      return await this.client.lPush(key, stringValues);
    } catch (error) {
      logger.error('Redis LPUSH error:', { key, error });
      throw error;
    }
  }

  async rpop<T = string>(key: string, parseJson = false): Promise<T | null> {
    try {
      const value = await this.client.rPop(key);
      
      if (value === null) {
        return null;
      }

      if (parseJson) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;
    } catch (error) {
      logger.error('Redis RPOP error:', { key, error });
      throw error;
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string | object): Promise<number> {
    try {
      const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.publisher.publish(channel, stringMessage);
    } catch (error) {
      logger.error('Redis PUBLISH error:', { channel, error });
      throw error;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string, callback: (message: string, channel: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, callback);
      logger.info('Subscribed to Redis channel', { channel });
    } catch (error) {
      logger.error('Redis SUBSCRIBE error:', { channel, error });
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel?: string): Promise<void> {
    try {
      if (channel) {
        await this.subscriber.unsubscribe(channel);
        logger.info('Unsubscribed from Redis channel', { channel });
      } else {
        await this.subscriber.unsubscribe();
        logger.info('Unsubscribed from all Redis channels');
      }
    } catch (error) {
      logger.error('Redis UNSUBSCRIBE error:', { channel, error });
      throw error;
    }
  }

  /**
   * Get Redis info
   */
  async info(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Redis INFO error:', error);
      throw error;
    }
  }

  /**
   * Ping Redis
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING error:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected && this.client.isReady;
  }

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get the number of members in a set
   */
  async scard(key: string): Promise<number> {
    try {
      return await this.client.sCard(key);
    } catch (error) {
      logger.error('Redis scard error:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Flush all data (use with caution!)
   */
  async flushall(): Promise<string> {
    try {
      return await this.client.flushAll();
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const redisService = new RedisService();
export default redisService;