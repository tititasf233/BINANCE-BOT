import { BaseModel, BaseModelFields } from './BaseModel';
import { db } from '../connection';
import { logger } from '@/utils/logger';
import { StrategyParams } from '@/trading/strategies/BaseStrategy';

export interface StrategyFields extends BaseModelFields {
  user_id: number;
  name: string;
  description?: string;
  symbol: string;
  interval: string;
  entry_conditions: any; // JSONB
  exit_conditions: any; // JSONB
  risk_params: any; // JSONB
  is_active: boolean;
}

export class StrategyModel extends BaseModel<StrategyFields> {
  constructor() {
    super('strategies', [
      'id',
      'user_id',
      'name',
      'description',
      'symbol',
      'interval',
      'entry_conditions',
      'exit_conditions',
      'risk_params',
      'is_active',
      'created_at',
      'updated_at'
    ]);
  }

  async findByUserId(userId: number): Promise<StrategyFields[]> {
    try {
      const query = 'SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC';
      const result = await db.query<StrategyFields>(query, [userId]);
      
      return result;
    } catch (error) {
      logger.error('Error finding strategies by user ID:', error);
      throw error;
    }
  }

  async findActiveByUserId(userId: number): Promise<StrategyFields[]> {
    try {
      const query = `
        SELECT * FROM strategies 
        WHERE user_id = $1 AND is_active = true 
        ORDER BY created_at DESC
      `;
      const result = await db.query<StrategyFields>(query, [userId]);
      
      return result;
    } catch (error) {
      logger.error('Error finding active strategies by user ID:', error);
      throw error;
    }
  }

  async findAllActive(): Promise<StrategyFields[]> {
    try {
      const query = 'SELECT * FROM strategies WHERE is_active = true ORDER BY created_at DESC';
      const result = await db.query<StrategyFields>(query);
      
      return result;
    } catch (error) {
      logger.error('Error finding all active strategies:', error);
      throw error;
    }
  }

  async findBySymbol(symbol: string): Promise<StrategyFields[]> {
    try {
      const query = 'SELECT * FROM strategies WHERE symbol = $1 AND is_active = true';
      const result = await db.query<StrategyFields>(query, [symbol]);
      
      return result;
    } catch (error) {
      logger.error('Error finding strategies by symbol:', error);
      throw error;
    }
  }

  async findBySymbolAndInterval(symbol: string, interval: string): Promise<StrategyFields[]> {
    try {
      const query = `
        SELECT * FROM strategies 
        WHERE symbol = $1 AND interval = $2 AND is_active = true
      `;
      const result = await db.query<StrategyFields>(query, [symbol, interval]);
      
      return result;
    } catch (error) {
      logger.error('Error finding strategies by symbol and interval:', error);
      throw error;
    }
  }

  async activateStrategy(id: number, userId: number): Promise<boolean> {
    try {
      const query = `
        UPDATE strategies 
        SET is_active = true, updated_at = NOW() 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(query, [id, userId]);
      
      const updated = result.length > 0;
      if (updated) {
        logger.info('Strategy activated', { id, userId });
      }
      
      return updated;
    } catch (error) {
      logger.error('Error activating strategy:', error);
      throw error;
    }
  }

  async deactivateStrategy(id: number, userId: number): Promise<boolean> {
    try {
      const query = `
        UPDATE strategies 
        SET is_active = false, updated_at = NOW() 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(query, [id, userId]);
      
      const updated = result.length > 0;
      if (updated) {
        logger.info('Strategy deactivated', { id, userId });
      }
      
      return updated;
    } catch (error) {
      logger.error('Error deactivating strategy:', error);
      throw error;
    }
  }

  async deactivateAllForUser(userId: number): Promise<boolean> {
    try {
      const query = `
        UPDATE strategies 
        SET is_active = false, updated_at = NOW() 
        WHERE user_id = $1
      `;
      await db.query(query, [userId]);
      
      logger.info('All strategies deactivated for user', { userId });
      return true;
    } catch (error) {
      logger.error('Error deactivating all strategies for user:', error);
      throw error;
    }
  }

  async findByNameAndUser(name: string, userId: number): Promise<StrategyFields | null> {
    try {
      const query = 'SELECT * FROM strategies WHERE name = $1 AND user_id = $2';
      const result = await db.query<StrategyFields>(query, [name, userId]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error finding strategy by name and user:', error);
      throw error;
    }
  }

  async getUserStrategyStats(userId: number): Promise<{
    total: number;
    active: number;
    bySymbol: Record<string, number>;
    byInterval: Record<string, number>;
  }> {
    try {
      const queries = [
        'SELECT COUNT(*) as count FROM strategies WHERE user_id = $1',
        'SELECT COUNT(*) as count FROM strategies WHERE user_id = $1 AND is_active = true',
        'SELECT symbol, COUNT(*) as count FROM strategies WHERE user_id = $1 GROUP BY symbol',
        'SELECT interval, COUNT(*) as count FROM strategies WHERE user_id = $1 GROUP BY interval'
      ];

      const results = await Promise.all([
        db.query<{ count: string }>(queries[0], [userId]),
        db.query<{ count: string }>(queries[1], [userId]),
        db.query<{ symbol: string; count: string }>(queries[2], [userId]),
        db.query<{ interval: string; count: string }>(queries[3], [userId])
      ]);

      const bySymbol: Record<string, number> = {};
      results[2].forEach(row => {
        bySymbol[row.symbol] = parseInt(row.count, 10);
      });

      const byInterval: Record<string, number> = {};
      results[3].forEach(row => {
        byInterval[row.interval] = parseInt(row.count, 10);
      });

      return {
        total: parseInt(results[0][0].count, 10),
        active: parseInt(results[1][0].count, 10),
        bySymbol,
        byInterval
      };
    } catch (error) {
      logger.error('Error getting user strategy stats:', error);
      throw error;
    }
  }

  async getSystemStrategyStats(): Promise<{
    totalStrategies: number;
    activeStrategies: number;
    totalUsers: number;
    topSymbols: Array<{ symbol: string; count: number }>;
    topIntervals: Array<{ interval: string; count: number }>;
  }> {
    try {
      const queries = [
        'SELECT COUNT(*) as count FROM strategies',
        'SELECT COUNT(*) as count FROM strategies WHERE is_active = true',
        'SELECT COUNT(DISTINCT user_id) as count FROM strategies',
        'SELECT symbol, COUNT(*) as count FROM strategies WHERE is_active = true GROUP BY symbol ORDER BY count DESC LIMIT 10',
        'SELECT interval, COUNT(*) as count FROM strategies WHERE is_active = true GROUP BY interval ORDER BY count DESC LIMIT 10'
      ];

      const results = await Promise.all([
        db.query<{ count: string }>(queries[0]),
        db.query<{ count: string }>(queries[1]),
        db.query<{ count: string }>(queries[2]),
        db.query<{ symbol: string; count: string }>(queries[3]),
        db.query<{ interval: string; count: string }>(queries[4])
      ]);

      const topSymbols = results[3].map(row => ({
        symbol: row.symbol,
        count: parseInt(row.count, 10)
      }));

      const topIntervals = results[4].map(row => ({
        interval: row.interval,
        count: parseInt(row.count, 10)
      }));

      return {
        totalStrategies: parseInt(results[0][0].count, 10),
        activeStrategies: parseInt(results[1][0].count, 10),
        totalUsers: parseInt(results[2][0].count, 10),
        topSymbols,
        topIntervals
      };
    } catch (error) {
      logger.error('Error getting system strategy stats:', error);
      throw error;
    }
  }

  /**
   * Convert database record to StrategyParams
   */
  toStrategyParams(strategy: StrategyFields): StrategyParams {
    return {
      symbol: strategy.symbol,
      interval: strategy.interval,
      entryConditions: strategy.entry_conditions,
      exitConditions: strategy.exit_conditions,
      riskParams: strategy.risk_params,
      indicatorParams: strategy.risk_params.indicatorParams || {}
    };
  }

  /**
   * Convert StrategyParams to database fields
   */
  fromStrategyParams(
    userId: number,
    name: string,
    params: StrategyParams,
    description?: string
  ): Omit<StrategyFields, 'id' | 'created_at' | 'updated_at'> {
    return {
      user_id: userId,
      name,
      description,
      symbol: params.symbol,
      interval: params.interval,
      entry_conditions: params.entryConditions,
      exit_conditions: params.exitConditions,
      risk_params: {
        ...params.riskParams,
        indicatorParams: params.indicatorParams
      },
      is_active: false
    };
  }
}

export const strategyModel = new StrategyModel();