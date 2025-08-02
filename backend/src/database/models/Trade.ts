import { BaseModel, BaseModelFields } from './BaseModel';
import { db } from '../connection';
import { logger } from '@/utils/logger';

export interface TradeFields extends BaseModelFields {
  strategy_id: number;
  binance_order_id_entry: number;
  binance_order_id_oco?: number;
  symbol: string;
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL' | 'FAILED';
  side: 'BUY' | 'SELL';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  entry_timestamp: Date;
  exit_timestamp?: Date;
  pnl?: number;
  fees: number;
  take_profit_price?: number;
  stop_loss_price?: number;
  metadata?: any; // JSONB for additional data
}

export class TradeModel extends BaseModel<TradeFields> {
  constructor() {
    super('trades', [
      'id',
      'strategy_id',
      'binance_order_id_entry',
      'binance_order_id_oco',
      'symbol',
      'status',
      'side',
      'entry_price',
      'exit_price',
      'quantity',
      'entry_timestamp',
      'exit_timestamp',
      'pnl',
      'fees',
      'take_profit_price',
      'stop_loss_price',
      'metadata',
      'created_at'
    ]);
  }

  async findByStrategyId(strategyId: number): Promise<TradeFields[]> {
    try {
      const query = 'SELECT * FROM trades WHERE strategy_id = $1 ORDER BY entry_timestamp DESC';
      const result = await db.query<TradeFields>(query, [strategyId]);
      
      return result;
    } catch (error) {
      logger.error('Error finding trades by strategy ID:', error);
      throw error;
    }
  }

  async findOpenTrades(): Promise<TradeFields[]> {
    try {
      const query = 'SELECT * FROM trades WHERE status = $1 ORDER BY entry_timestamp DESC';
      const result = await db.query<TradeFields>(query, ['OPEN']);
      
      return result;
    } catch (error) {
      logger.error('Error finding open trades:', error);
      throw error;
    }
  }

  async findOpenTradesByStrategy(strategyId: number): Promise<TradeFields[]> {
    try {
      const query = `
        SELECT * FROM trades 
        WHERE strategy_id = $1 AND status = 'OPEN' 
        ORDER BY entry_timestamp DESC
      `;
      const result = await db.query<TradeFields>(query, [strategyId]);
      
      return result;
    } catch (error) {
      logger.error('Error finding open trades by strategy:', error);
      throw error;
    }
  }

  async findByBinanceOrderId(orderId: number): Promise<TradeFields | null> {
    try {
      const query = `
        SELECT * FROM trades 
        WHERE binance_order_id_entry = $1 OR binance_order_id_oco = $1
      `;
      const result = await db.query<TradeFields>(query, [orderId]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error finding trade by Binance order ID:', error);
      throw error;
    }
  }

  async findBySymbol(symbol: string, limit?: number): Promise<TradeFields[]> {
    try {
      let query = 'SELECT * FROM trades WHERE symbol = $1 ORDER BY entry_timestamp DESC';
      const values: any[] = [symbol];

      if (limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      const result = await db.query<TradeFields>(query, values);
      return result;
    } catch (error) {
      logger.error('Error finding trades by symbol:', error);
      throw error;
    }
  }

  async closeTrade(
    id: number, 
    exitPrice: number, 
    status: 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL',
    fees: number = 0
  ): Promise<TradeFields | null> {
    try {
      const trade = await this.findById(id);
      if (!trade) {
        return null;
      }

      // Calculate PnL
      const pnl = trade.side === 'BUY' 
        ? (exitPrice - trade.entry_price) * trade.quantity
        : (trade.entry_price - exitPrice) * trade.quantity;

      const updates = {
        status,
        exit_price: exitPrice,
        exit_timestamp: new Date(),
        pnl: pnl - fees,
        fees: trade.fees + fees
      };

      const updatedTrade = await this.update(id, updates);
      
      if (updatedTrade) {
        logger.info('Trade closed', {
          tradeId: id,
          status,
          pnl: updatedTrade.pnl,
          exitPrice
        });
      }

      return updatedTrade;
    } catch (error) {
      logger.error('Error closing trade:', error);
      throw error;
    }
  }

  async updateOCOOrderId(id: number, ocoOrderId: number): Promise<boolean> {
    try {
      const updates = { binance_order_id_oco: ocoOrderId };
      const updatedTrade = await this.update(id, updates);
      
      return updatedTrade !== null;
    } catch (error) {
      logger.error('Error updating OCO order ID:', error);
      throw error;
    }
  }

  async getTradeStats(strategyId?: number): Promise<{
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    totalFees: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  }> {
    try {
      const whereClause = strategyId ? 'WHERE strategy_id = $1' : '';
      const params = strategyId ? [strategyId] : [];

      const queries = [
        `SELECT COUNT(*) as count FROM trades ${whereClause}`,
        `SELECT COUNT(*) as count FROM trades ${whereClause} AND status = 'OPEN'`,
        `SELECT COUNT(*) as count FROM trades ${whereClause} AND status != 'OPEN'`,
        `SELECT COUNT(*) as count FROM trades ${whereClause} AND pnl > 0`,
        `SELECT COUNT(*) as count FROM trades ${whereClause} AND pnl < 0`,
        `SELECT COALESCE(SUM(pnl), 0) as sum FROM trades ${whereClause}`,
        `SELECT COALESCE(SUM(fees), 0) as sum FROM trades ${whereClause}`,
        `SELECT COALESCE(AVG(pnl), 0) as avg FROM trades ${whereClause} AND pnl > 0`,
        `SELECT COALESCE(AVG(pnl), 0) as avg FROM trades ${whereClause} AND pnl < 0`,
        `SELECT COALESCE(SUM(pnl), 0) as sum FROM trades ${whereClause} AND pnl > 0`,
        `SELECT COALESCE(ABS(SUM(pnl)), 1) as sum FROM trades ${whereClause} AND pnl < 0`
      ];

      const results = await Promise.all(
        queries.map(query => db.query<{ count?: string; sum?: string; avg?: string }>(query, params))
      );

      const totalTrades = parseInt(results[0][0].count || '0', 10);
      const openTrades = parseInt(results[1][0].count || '0', 10);
      const closedTrades = parseInt(results[2][0].count || '0', 10);
      const winningTrades = parseInt(results[3][0].count || '0', 10);
      const losingTrades = parseInt(results[4][0].count || '0', 10);
      const totalPnl = parseFloat(results[5][0].sum || '0');
      const totalFees = parseFloat(results[6][0].sum || '0');
      const avgWin = parseFloat(results[7][0].avg || '0');
      const avgLoss = parseFloat(results[8][0].avg || '0');
      const grossProfit = parseFloat(results[9][0].sum || '0');
      const grossLoss = parseFloat(results[10][0].sum || '1');

      const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

      return {
        totalTrades,
        openTrades,
        closedTrades,
        winningTrades,
        losingTrades,
        totalPnl,
        totalFees,
        winRate,
        avgWin,
        avgLoss,
        profitFactor
      };
    } catch (error) {
      logger.error('Error getting trade stats:', error);
      throw error;
    }
  }

  async getRecentTrades(limit: number = 10, strategyId?: number): Promise<TradeFields[]> {
    try {
      const whereClause = strategyId ? 'WHERE strategy_id = $1' : '';
      const params = strategyId ? [strategyId, limit] : [limit];
      const paramIndex = strategyId ? 2 : 1;

      const query = `
        SELECT * FROM trades ${whereClause}
        ORDER BY entry_timestamp DESC 
        LIMIT $${paramIndex}
      `;

      return await db.query<TradeFields>(query, params);
    } catch (error) {
      logger.error('Error getting recent trades:', error);
      throw error;
    }
  }

  async getTradesByDateRange(
    startDate: Date, 
    endDate: Date, 
    strategyId?: number
  ): Promise<TradeFields[]> {
    try {
      let query = `
        SELECT * FROM trades 
        WHERE entry_timestamp >= $1 AND entry_timestamp <= $2
      `;
      const params: any[] = [startDate, endDate];

      if (strategyId) {
        query += ' AND strategy_id = $3';
        params.push(strategyId);
      }

      query += ' ORDER BY entry_timestamp DESC';

      return await db.query<TradeFields>(query, params);
    } catch (error) {
      logger.error('Error getting trades by date range:', error);
      throw error;
    }
  }

  async getOrphanedTrades(): Promise<TradeFields[]> {
    try {
      // Find trades that are OPEN but don't have OCO orders
      const query = `
        SELECT * FROM trades 
        WHERE status = 'OPEN' AND binance_order_id_oco IS NULL
        ORDER BY entry_timestamp ASC
      `;
      
      return await db.query<TradeFields>(query);
    } catch (error) {
      logger.error('Error finding orphaned trades:', error);
      throw error;
    }
  }

  async markTradeAsFailed(id: number, reason: string): Promise<boolean> {
    try {
      const updates = {
        status: 'FAILED' as const,
        metadata: { failureReason: reason, failedAt: new Date() }
      };

      const updatedTrade = await this.update(id, updates);
      return updatedTrade !== null;
    } catch (error) {
      logger.error('Error marking trade as failed:', error);
      throw error;
    }
  }

  async getDailyPnL(date: Date, strategyId?: number): Promise<number> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      let query = `
        SELECT COALESCE(SUM(pnl), 0) as daily_pnl 
        FROM trades 
        WHERE exit_timestamp >= $1 AND exit_timestamp <= $2
      `;
      const params: any[] = [startOfDay, endOfDay];

      if (strategyId) {
        query += ' AND strategy_id = $3';
        params.push(strategyId);
      }

      const result = await db.query<{ daily_pnl: string }>(query, params);
      return parseFloat(result[0].daily_pnl);
    } catch (error) {
      logger.error('Error getting daily PnL:', error);
      throw error;
    }
  }
}

export const tradeModel = new TradeModel();