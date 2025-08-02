import { Response } from 'express';
import { strategyService } from '@/services/StrategyService';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import Joi from 'joi';

// Validation schemas
const createStrategySchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.min': 'Strategy name must be at least 3 characters long',
      'string.max': 'Strategy name must not exceed 50 characters',
      'any.required': 'Strategy name is required'
    }),
  description: Joi.string()
    .max(200)
    .optional()
    .messages({
      'string.max': 'Description must not exceed 200 characters'
    }),
  type: Joi.string()
    .valid('RSI', 'MACD', 'CUSTOM')
    .required()
    .messages({
      'any.only': 'Strategy type must be one of: RSI, MACD, CUSTOM',
      'any.required': 'Strategy type is required'
    }),
  symbol: Joi.string()
    .uppercase()
    .pattern(/^[A-Z]{2,10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Symbol must be uppercase letters only (e.g., BTCUSDT)',
      'any.required': 'Symbol is required'
    }),
  interval: Joi.string()
    .valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M')
    .required()
    .messages({
      'any.only': 'Invalid interval',
      'any.required': 'Interval is required'
    }),
  params: Joi.object().optional()
});

const updateStrategySchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(50)
    .optional(),
  description: Joi.string()
    .max(200)
    .optional(),
  params: Joi.object().optional()
});

const strategyIdSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Strategy ID must be a number',
      'number.integer': 'Strategy ID must be an integer',
      'number.positive': 'Strategy ID must be positive',
      'any.required': 'Strategy ID is required'
    })
});

export class StrategyController {
  /**
   * Create new strategy
   */
  async createStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = createStrategySchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // Create strategy
      const result = await strategyService.createStrategy(req.user.id, value);

      if (result.success) {
        logger.info('Strategy created successfully', {
          userId: req.user.id,
          strategyId: result.data?.id,
          name: result.data?.name
        });

        res.status(201).json({
          success: true,
          message: 'Strategy created successfully',
          data: result.data
        });
      } else {
        const statusCode = result.code === 'STRATEGY_NAME_EXISTS' ? 409 :
                          result.code === 'STRATEGY_VALIDATION_FAILED' ? 400 : 400;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Create strategy controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get user's strategies
   */
  async getStrategies(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await strategyService.getUserStrategies(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            strategies: result.data
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'STRATEGIES_FETCH_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get strategies controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request params
      const { error, value } = strategyIdSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await strategyService.getStrategy(req.user.id, value.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        const statusCode = result.code === 'STRATEGY_NOT_FOUND' ? 404 : 500;
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Get strategy controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update strategy
   */
  async updateStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request params
      const { error: paramsError, value: paramsValue } = strategyIdSchema.validate(req.params);
      if (paramsError) {
        res.status(400).json({
          success: false,
          error: paramsError.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // Validate request body
      const { error: bodyError, value: bodyValue } = updateStrategySchema.validate(req.body);
      if (bodyError) {
        res.status(400).json({
          success: false,
          error: bodyError.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await strategyService.updateStrategy(req.user.id, paramsValue.id, bodyValue);

      if (result.success) {
        logger.info('Strategy updated successfully', {
          userId: req.user.id,
          strategyId: paramsValue.id
        });

        res.status(200).json({
          success: true,
          message: 'Strategy updated successfully',
          data: result.data
        });
      } else {
        const statusCode = result.code === 'STRATEGY_NOT_FOUND' ? 404 :
                          result.code === 'STRATEGY_NAME_EXISTS' ? 409 :
                          result.code === 'STRATEGY_ACTIVE' ? 400 : 400;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Update strategy controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Delete strategy
   */
  async deleteStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request params
      const { error, value } = strategyIdSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await strategyService.deleteStrategy(req.user.id, value.id);

      if (result.success) {
        logger.info('Strategy deleted successfully', {
          userId: req.user.id,
          strategyId: value.id
        });

        res.status(200).json({
          success: true,
          message: 'Strategy deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
          code: 'STRATEGY_NOT_FOUND'
        });
      }

    } catch (error) {
      logger.error('Delete strategy controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Activate strategy
   */
  async activateStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request params
      const { error, value } = strategyIdSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await strategyService.activateStrategy(req.user.id, value.id);

      if (result.success) {
        logger.info('Strategy activated successfully', {
          userId: req.user.id,
          strategyId: value.id
        });

        res.status(200).json({
          success: true,
          message: 'Strategy activated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: 'STRATEGY_ACTIVATION_FAILED'
        });
      }

    } catch (error) {
      logger.error('Activate strategy controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Deactivate strategy
   */
  async deactivateStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request params
      const { error, value } = strategyIdSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await strategyService.deactivateStrategy(req.user.id, value.id);

      if (result.success) {
        logger.info('Strategy deactivated successfully', {
          userId: req.user.id,
          strategyId: value.id
        });

        res.status(200).json({
          success: true,
          message: 'Strategy deactivated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: 'STRATEGY_DEACTIVATION_FAILED'
        });
      }

    } catch (error) {
      logger.error('Deactivate strategy controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get strategy statistics
   */
  async getStrategyStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await strategyService.getStrategyStats(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            stats: result.stats
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'STATS_FETCH_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get strategy stats controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get strategy performance
   */
  async getStrategyPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request params
      const { error, value } = strategyIdSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await strategyService.getStrategyPerformance(req.user.id, value.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            performance: result.performance
          }
        });
      } else {
        const statusCode = result.error === 'Strategy not found' ? 404 : 500;
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: 'PERFORMANCE_FETCH_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get strategy performance controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

export const strategyController = new StrategyController();