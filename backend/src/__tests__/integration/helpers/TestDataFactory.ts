import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { encrypt } from '../../../utils/crypto';

export interface TestUser {
  id: number;
  username: string;
  email: string;
  password: string;
}

export interface TestStrategy {
  id: number;
  userId: number;
  name: string;
  symbol: string;
  interval: string;
  entryConditions: any;
  exitConditions: any;
  riskParams: any;
  isActive: boolean;
}

export interface TestApiKey {
  id: number;
  userId: number;
  binanceApiKey: string;
  binanceSecretKeyEncrypted: string;
  isActive: boolean;
}

export class TestDataFactory {
  constructor(private dbPool: Pool) {}

  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const defaultUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    const userData = { ...defaultUser, ...overrides };
    const passwordHash = await bcrypt.hash(userData.password, 12);

    const client = await this.dbPool.connect();
    try {
      const result = await client.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [userData.username, userData.email, passwordHash]
      );

      client.release();
      return {
        id: result.rows[0].id,
        ...userData,
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async createTestApiKey(userId: number, overrides: Partial<TestApiKey> = {}): Promise<TestApiKey> {
    const defaultApiKey = {
      binanceApiKey: 'test_api_key_' + Date.now(),
      binanceSecretKey: 'test_secret_key_' + Date.now(),
      isActive: true,
    };

    const apiKeyData = { ...defaultApiKey, ...overrides };
    const encryptedSecretKey = encrypt(apiKeyData.binanceSecretKey);

    const client = await this.dbPool.connect();
    try {
      const result = await client.query(
        'INSERT INTO user_api_keys (user_id, binance_api_key, binance_secret_key_encrypted, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, apiKeyData.binanceApiKey, encryptedSecretKey, apiKeyData.isActive]
      );

      client.release();
      return {
        id: result.rows[0].id,
        userId,
        binanceApiKey: apiKeyData.binanceApiKey,
        binanceSecretKeyEncrypted: encryptedSecretKey,
        isActive: apiKeyData.isActive,
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async createTestStrategy(userId: number, overrides: Partial<TestStrategy> = {}): Promise<TestStrategy> {
    const defaultStrategy = {
      name: `Test Strategy ${Date.now()}`,
      symbol: 'BTCUSDT',
      interval: '1h',
      entryConditions: [
        {
          indicator: 'RSI',
          operator: '<',
          value: 30,
        },
      ],
      exitConditions: [
        {
          indicator: 'RSI',
          operator: '>',
          value: 70,
        },
      ],
      riskParams: {
        positionSizeUsd: 100,
        takeProfitPercent: 2.0,
        stopLossPercent: 1.0,
        maxDrawdownPercent: 5.0,
      },
      isActive: false,
    };

    const strategyData = { ...defaultStrategy, ...overrides };

    const client = await this.dbPool.connect();
    try {
      const result = await client.query(
        `INSERT INTO strategies 
         (user_id, name, symbol, interval, entry_conditions, exit_conditions, risk_params, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [
          userId,
          strategyData.name,
          strategyData.symbol,
          strategyData.interval,
          JSON.stringify(strategyData.entryConditions),
          JSON.stringify(strategyData.exitConditions),
          JSON.stringify(strategyData.riskParams),
          strategyData.isActive,
        ]
      );

      client.release();
      return {
        id: result.rows[0].id,
        userId,
        ...strategyData,
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async createTestTrade(strategyId: number, overrides: any = {}): Promise<any> {
    const defaultTrade = {
      binanceOrderIdEntry: Math.floor(Math.random() * 1000000000),
      binanceOrderIdOco: Math.floor(Math.random() * 1000000000),
      symbol: 'BTCUSDT',
      status: 'OPEN',
      entryPrice: '45000.00',
      exitPrice: null,
      quantity: '0.001',
      entryTimestamp: new Date(),
      exitTimestamp: null,
      pnl: null,
      fees: '0.00',
    };

    const tradeData = { ...defaultTrade, ...overrides };

    const client = await this.dbPool.connect();
    try {
      const result = await client.query(
        `INSERT INTO trades 
         (strategy_id, binance_order_id_entry, binance_order_id_oco, symbol, status, 
          entry_price, exit_price, quantity, entry_timestamp, exit_timestamp, pnl, fees) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING id`,
        [
          strategyId,
          tradeData.binanceOrderIdEntry,
          tradeData.binanceOrderIdOco,
          tradeData.symbol,
          tradeData.status,
          tradeData.entryPrice,
          tradeData.exitPrice,
          tradeData.quantity,
          tradeData.entryTimestamp,
          tradeData.exitTimestamp,
          tradeData.pnl,
          tradeData.fees,
        ]
      );

      client.release();
      return {
        id: result.rows[0].id,
        strategyId,
        ...tradeData,
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  // Helper method to create a complete test scenario
  async createCompleteTestScenario(): Promise<{
    user: TestUser;
    apiKey: TestApiKey;
    strategy: TestStrategy;
  }> {
    const user = await this.createTestUser();
    const apiKey = await this.createTestApiKey(user.id);
    const strategy = await this.createTestStrategy(user.id);

    return { user, apiKey, strategy };
  }
}