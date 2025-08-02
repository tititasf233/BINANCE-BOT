import { strategyModel, StrategyFields } from '@/database/models/Strategy';
import { strategyEngine } from './StrategyEngineService';
import { StrategyParams } from '@/trading/strategies/BaseStrategy';
import { StrategyValidator } from '@/trading/strategies/StrategyValidator';
import { RSIStrategy } from '@/trading/strategies/RSIStrategy';
import { MACDStrategy } from '@/trading/strategies/MACDStrategy';
import { logger } from '@/utils/logger';

export interface CreateStrategyData {
  name: string;
  description?: string;
  type: 'RSI' | 'MACD' | 'CUSTOM';
  symbol: string;
  interval: string;
  params?: Partial<StrategyParams>;
}

export interface StrategyResponse {
  success: boolean;
  data?: {
    id: number;
    name: string;
    description?: string;
    symbol: string;
    interval: string;
    isActive: boolean;
    createdAt: Date;
    params?: StrategyParams;
  };
  error?: string;
  code?: string;
}

export interface StrategyListResponse {
  success: boolean;
  data?: Array<{
    id: number;
    name: string;
    description?: string;
    symbol: string;
    interval: string;
    isActive: boolean;
    createdAt: Date;
    lastSignal?: {
      signal: string;
      timestamp: number;
      strength: number;
    };
  }>;
  error?: string;
}

export class StrategyService {
  /**
   * Create a new strategy
   */
  async createStrategy(userId: number, data: CreateStrategyData): Promise<StrategyResponse> {
    try {
      const { name, description, type, symbol, interval, params } = data;

      // Check if strategy name already exists for user
      const existingStrategy = await strategyModel.findByNameAndUser(name, userId);
      if (existingStrategy) {
        return {
          success: false,
          error: 'Strategy name already exists',
          code: 'STRATEGY_NAME_EXISTS'
        };
      }

      // Create default parameters based on strategy type
      let strategyParams: StrategyParams;
      
      switch (type) {
        case 'RSI':
          strategyParams = RSIStrategy.createDefaultParams(symbol, interval);
          break;
        case 'MACD':
          strategyParams = MACDStrategy.createDefaultParams(symbol, interval);
          break;
        case 'CUSTOM':
          if (!params) {
            return {
              success: false,
              error: 'Custom strategy requires parameters',
              code: 'STRATEGY_PARAMS_REQUIRED'
            };
          }
          strategyParams = {
            symbol,
            interval,
            entryConditions: params.entryConditions || [],
            exitConditions: params.exitConditions || [],
            riskParams: params.riskParams || {
              positionSizeUsd: 100,
              takeProfitPercent: 3,
              stopLossPercent: 2,
              maxDrawdownPercent: 10,
              maxPositions: 1
            },
            indicatorParams: params.indicatorParams || {}
          };
          break;
        default:
          return {
            success: false,
            error: 'Invalid strategy type',
            code: 'STRATEGY_INVALID_TYPE'
          };
      }

      // Merge with provided params if any
      if (params) {
        strategyParams = {
          ...strategyParams,
          ...params,
          symbol, // Ensure symbol and interval are not overridden
          interval
        };
      }

      // Validate strategy parameters
      const validation = StrategyValidator.validateStrategy(strategyParams);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Strategy validation failed: ${validation.errors.join(', ')}`,
          code: 'STRATEGY_VALIDATION_FAILED'
        };
      }

      // Convert to database format
      const dbData = strategyModel.fromStrategyParams(userId, name, strategyParams, description);

      // Create strategy in database
      const newStrategy = await strategyModel.create(dbData);

      logger.info('Strategy created', {
        userId,
        strategyId: newStrategy.id,
        name,
        symbol,
        type
      });

      return {
        success: true,
        data: {
          id: newStrategy.id!,
          name: newStrategy.name,
          description: newStrategy.description,
          symbol: newStrategy.symbol,
          interval: newStrategy.interval,
          isActive: newStrategy.is_active,
          createdAt: newStrategy.created_at!,
          params: strategyParams
        }
      };

    } catch (error) {
      logger.error('Error creating strategy:', error);
      return {
        success: false,
        error: 'Failed to create strategy',
        code: 'STRATEGY_CREATE_FAILED'
      };
    }
  }

  /**
   * Get user's strategies
   */
  async getUserStrategies(userId: number): Promise<StrategyListResponse> {
    try {
      const strategies = await strategyModel.findByUserId(userId);

      const strategiesWithStatus = await Promise.all(
        strategies.map(async (strategy) => {
          const instance = strategyEngine.getStrategy(strategy.id!);
          
          return {
            id: strategy.id!,
            name: strategy.name,
            description: strategy.description,
            symbol: strategy.symbol,
            interval: strategy.interval,
            isActive: strategy.is_active,
            createdAt: strategy.created_at!,
            lastSignal: instance?.lastSignal ? {
              signal: instance.lastSignal.signal,
              timestamp: instance.lastSignal.timestamp,
              strength: instance.lastSignal.strength
            } : undefined
          };
        })
      );

      return {
        success: true,
        data: strategiesWithStatus
      };

    } catch (error) {
      logger.error('Error getting user strategies:', error);
      return {
        success: false,
        error: 'Failed to get strategies'
      };
    }
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(userId: number, strategyId: number): Promise<StrategyResponse> {
    try {
      const strategy = await strategyModel.findById(strategyId);
      
      if (!strategy || strategy.user_id !== userId) {
        return {
          success: false,
          error: 'Strategy not found',
          code: 'STRATEGY_NOT_FOUND'
        };
      }

      const params = strategyModel.toStrategyParams(strategy);

      return {
        success: true,
        data: {
          id: strategy.id!,
          name: strategy.name,
          description: strategy.description,
          symbol: strategy.symbol,
          interval: strategy.interval,
          isActive: strategy.is_active,
          createdAt: strategy.created_at!,
          params
        }
      };

    } catch (error) {
      logger.error('Error getting strategy:', error);
      return {
        success: false,
        error: 'Failed to get strategy'
      };
    }
  }

  /**
   * Update strategy
   */
  async updateStrategy(
    userId: number, 
    strategyId: number, 
    updateData: Partial<CreateStrategyData>
  ): Promise<StrategyResponse> {
    try {
      const strategy = await strategyModel.findById(strategyId);
      
      if (!strategy || strategy.user_id !== userId) {
        return {
          success: false,
          error: 'Strategy not found',
          code: 'STRATEGY_NOT_FOUND'
        };
      }

      // Don't allow updating active strategies
      if (strategy.is_active) {
        return {
          success: false,
          error: 'Cannot update active strategy. Deactivate first.',
          code: 'STRATEGY_ACTIVE'
        };
      }

      // Prepare update data
      const updates: Partial<StrategyFields> = {};

      if (updateData.name && updateData.name !== strategy.name) {
        // Check if new name already exists
        const existingStrategy = await strategyModel.findByNameAndUser(updateData.name, userId);
        if (existingStrategy && existingStrategy.id !== strategyId) {
          return {
            success: false,
            error: 'Strategy name already exists',
            code: 'STRATEGY_NAME_EXISTS'
          };
        }
        updates.name = updateData.name;
      }

      if (updateData.description !== undefined) {
        updates.description = updateData.description;
      }

      if (updateData.params) {
        // Merge with existing params
        const currentParams = strategyModel.toStrategyParams(strategy);
        const newParams = {
          ...currentParams,
          ...updateData.params
        };

        // Validate updated parameters
        const validation = StrategyValidator.validateStrategy(newParams);
        if (!validation.isValid) {
          return {
            success: false,
            error: `Strategy validation failed: ${validation.errors.join(', ')}`,
            code: 'STRATEGY_VALIDATION_FAILED'
          };
        }

        updates.entry_conditions = newParams.entryConditions;
        updates.exit_conditions = newParams.exitConditions;
        updates.risk_params = {
          ...newParams.riskParams,
          indicatorParams: newParams.indicatorParams
        };
      }

      // Update strategy
      const updatedStrategy = await strategyModel.update(strategyId, updates);
      
      if (!updatedStrategy) {
        return {
          success: false,
          error: 'Failed to update strategy',
          code: 'STRATEGY_UPDATE_FAILED'
        };
      }

      logger.info('Strategy updated', {
        userId,
        strategyId,
        updates: Object.keys(updates)
      });

      const params = strategyModel.toStrategyParams(updatedStrategy);

      return {
        success: true,
        data: {
          id: updatedStrategy.id!,
          name: updatedStrategy.name,
          description: updatedStrategy.description,
          symbol: updatedStrategy.symbol,
          interval: updatedStrategy.interval,
          isActive: updatedStrategy.is_active,
          createdAt: updatedStrategy.created_at!,
          params
        }
      };

    } catch (error) {
      logger.error('Error updating strategy:', error);
      return {
        success: false,
        error: 'Failed to update strategy'
      };
    }
  }

  /**
   * Delete strategy
   */
  async deleteStrategy(userId: number, strategyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const strategy = await strategyModel.findById(strategyId);
      
      if (!strategy || strategy.user_id !== userId) {
        return {
          success: false,
          error: 'Strategy not found'
        };
      }

      // Don't allow deleting active strategies
      if (strategy.is_active) {
        return {
          success: false,
          error: 'Cannot delete active strategy. Deactivate first.'
        };
      }

      await strategyModel.delete(strategyId);

      logger.info('Strategy deleted', { userId, strategyId });

      return { success: true };

    } catch (error) {
      logger.error('Error deleting strategy:', error);
      return {
        success: false,
        error: 'Failed to delete strategy'
      };
    }
  }

  /**
   * Activate strategy
   */
  async activateStrategy(userId: number, strategyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const strategy = await strategyModel.findById(strategyId);
      
      if (!strategy || strategy.user_id !== userId) {
        return {
          success: false,
          error: 'Strategy not found'
        };
      }

      if (strategy.is_active) {
        return {
          success: false,
          error: 'Strategy is already active'
        };
      }

      // Activate in database
      await strategyModel.activateStrategy(strategyId, userId);

      // Start in strategy engine
      const updatedStrategy = await strategyModel.findById(strategyId);
      if (updatedStrategy) {
        await strategyEngine.startStrategy(updatedStrategy);
      }

      logger.info('Strategy activated', { userId, strategyId });

      return { success: true };

    } catch (error) {
      logger.error('Error activating strategy:', error);
      return {
        success: false,
        error: 'Failed to activate strategy'
      };
    }
  }

  /**
   * Deactivate strategy
   */
  async deactivateStrategy(userId: number, strategyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const strategy = await strategyModel.findById(strategyId);
      
      if (!strategy || strategy.user_id !== userId) {
        return {
          success: false,
          error: 'Strategy not found'
        };
      }

      if (!strategy.is_active) {
        return {
          success: false,
          error: 'Strategy is already inactive'
        };
      }

      // Stop in strategy engine first
      await strategyEngine.stopStrategy(strategyId);

      // Deactivate in database
      await strategyModel.deactivateStrategy(strategyId, userId);

      logger.info('Strategy deactivated', { userId, strategyId });

      return { success: true };

    } catch (error) {
      logger.error('Error deactivating strategy:', error);
      return {
        success: false,
        error: 'Failed to deactivate strategy'
      };
    }
  }

  /**
   * Get strategy statistics
   */
  async getStrategyStats(userId: number): Promise<{
    success: boolean;
    stats?: {
      total: number;
      active: number;
      bySymbol: Record<string, number>;
      byInterval: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const stats = await strategyModel.getUserStrategyStats(userId);

      return {
        success: true,
        stats
      };

    } catch (error) {
      logger.error('Error getting strategy stats:', error);
      return {
        success: false,
        error: 'Failed to get strategy statistics'
      };
    }
  }

  /**
   * Get strategy performance metrics
   */
  async getStrategyPerformance(userId: number, strategyId: number): Promise<{
    success: boolean;
    performance?: {
      totalSignals: number;
      signalsToday: number;
      lastSignal?: {
        signal: string;
        timestamp: number;
        strength: number;
      };
      isRunning: boolean;
      uptime: number;
    };
    error?: string;
  }> {
    try {
      const strategy = await strategyModel.findById(strategyId);
      
      if (!strategy || strategy.user_id !== userId) {
        return {
          success: false,
          error: 'Strategy not found'
        };
      }

      const instance = strategyEngine.getStrategy(strategyId);
      const uptime = instance ? Date.now() - instance.lastUpdate : 0;

      return {
        success: true,
        performance: {
          totalSignals: 0, // Would need to track this
          signalsToday: 0, // Would need to track this
          lastSignal: instance?.lastSignal ? {
            signal: instance.lastSignal.signal,
            timestamp: instance.lastSignal.timestamp,
            strength: instance.lastSignal.strength
          } : undefined,
          isRunning: instance?.isRunning || false,
          uptime
        }
      };

    } catch (error) {
      logger.error('Error getting strategy performance:', error);
      return {
        success: false,
        error: 'Failed to get strategy performance'
      };
    }
  }
}

export const strategyService = new StrategyService();