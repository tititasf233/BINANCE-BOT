import { Response } from 'express';
import { portfolioService } from '@/services/PortfolioService';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import Joi from 'joi';

// Validation schemas
const daysSchema = Joi.object({
  days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .messages({
      'number.integer': 'Days must be an integer',
      'number.min': 'Days must be at least 1',
      'number.max': 'Days cannot exceed 365'
    })
});

export class PortfolioController {
  /**
   * Get portfolio overview
   */
  async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await portfolioService.getPortfolioOverview(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        const statusCode = result.error?.includes('No active API credentials') ? 400 : 500;
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: 'PORTFOLIO_OVERVIEW_FAILED'
        });
      }

    } catch (error) {
      logger.error('Portfolio overview controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get open positions
   */
  async getOpenPositions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await portfolioService.getOpenPositions(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            positions: result.data,
            count: result.data?.length || 0
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'POSITIONS_FETCH_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get open positions controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get daily PnL history
   */
  async getDailyPnL(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = daysSchema.validate(req.query);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await portfolioService.getDailyPnLHistory(req.user.id, value.days);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            history: result.data,
            period: `${value.days} days`
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'PNL_HISTORY_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get daily PnL controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get strategy allocation
   */
  async getStrategyAllocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await portfolioService.getStrategyAllocation(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            allocation: result.data
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'ALLOCATION_FETCH_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get strategy allocation controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get portfolio statistics
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await portfolioService.getPortfolioStats(req.user.id);

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
      logger.error('Get portfolio stats controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Refresh portfolio data (clear cache)
   */
  async refreshData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await portfolioService.clearCache(req.user.id);

      logger.info('Portfolio cache cleared', { userId: req.user.id });

      res.status(200).json({
        success: true,
        message: 'Portfolio data refreshed successfully'
      });

    } catch (error) {
      logger.error('Refresh portfolio data controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get portfolio performance summary
   */
  async getPerformanceSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Get both overview and stats
      const [overviewResult, statsResult] = await Promise.all([
        portfolioService.getPortfolioOverview(req.user.id),
        portfolioService.getPortfolioStats(req.user.id)
      ]);

      if (!overviewResult.success) {
        res.status(500).json({
          success: false,
          error: overviewResult.error,
          code: 'OVERVIEW_FETCH_FAILED'
        });
        return;
      }

      if (!statsResult.success) {
        res.status(500).json({
          success: false,
          error: statsResult.error,
          code: 'STATS_FETCH_FAILED'
        });
        return;
      }

      const overview = overviewResult.data!;
      const stats = statsResult.stats!;

      const performanceSummary = {
        portfolio: {
          totalValue: overview.totalValue,
          totalPnl: overview.totalPnl,
          dailyPnl: overview.dailyPnl,
          totalFees: overview.totalFees,
          openPositions: overview.openPositions,
          activeStrategies: overview.activeStrategies
        },
        performance: {
          totalTrades: stats.totalTrades,
          winRate: stats.winRate,
          bestTrade: stats.bestTrade,
          worstTrade: stats.worstTrade,
          profitFactor: overview.performance.profitFactor,
          sharpeRatio: overview.performance.sharpeRatio,
          maxDrawdown: overview.performance.maxDrawdown
        },
        timeBasedPnL: {
          daily: stats.dailyPnl,
          weekly: stats.weeklyPnl,
          monthly: stats.monthlyPnl
        },
        topAssets: overview.balances.slice(0, 5).map(balance => ({
          asset: balance.asset,
          value: balance.usdValue,
          percentage: balance.percentage
        }))
      };

      res.status(200).json({
        success: true,
        data: performanceSummary
      });

    } catch (error) {
      logger.error('Get performance summary controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get portfolio balance breakdown
   */
  async getBalanceBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await portfolioService.getPortfolioOverview(req.user.id);

      if (result.success) {
        const balances = result.data!.balances;
        
        // Group small balances
        const significantBalances = balances.filter(b => b.percentage >= 1);
        const smallBalances = balances.filter(b => b.percentage < 1);
        
        const smallBalancesSum = smallBalances.reduce((sum, b) => sum + b.usdValue, 0);
        const smallBalancesPercentage = smallBalances.reduce((sum, b) => sum + b.percentage, 0);

        const breakdown = [
          ...significantBalances,
          ...(smallBalances.length > 0 ? [{
            asset: 'Others',
            free: 0,
            locked: 0,
            total: 0,
            usdValue: smallBalancesSum,
            percentage: smallBalancesPercentage
          }] : [])
        ];

        res.status(200).json({
          success: true,
          data: {
            breakdown,
            totalValue: result.data!.totalValue,
            assetCount: balances.length
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'BALANCE_BREAKDOWN_FAILED'
        });
      }

    } catch (error) {
      logger.error('Get balance breakdown controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

export const portfolioController = new PortfolioController();