import { Router } from 'express';
import { backtestController } from '@/controllers/BacktestController';
import { 
  authenticateToken, 
  requireEmailVerification,
  rateLimitByUser 
} from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/backtest/run
 * @desc    Run backtest for a strategy
 * @access  Private (requires email verification)
 */
router.post(
  '/run',
  requireEmailVerification,
  rateLimitByUser(5, 60 * 60 * 1000), // 5 backtests per hour
  backtestController.runBacktest
);

/**
 * @route   GET /api/v1/backtest/templates
 * @desc    Get backtest templates for different strategy types
 * @access  Private
 */
router.get('/templates', backtestController.getBacktestTemplates);

/**
 * @route   GET /api/v1/backtest/symbols
 * @desc    Get available symbols and intervals for backtesting
 * @access  Private
 */
router.get('/symbols', backtestController.getAvailableSymbols);

/**
 * @route   GET /api/v1/backtest/metrics
 * @desc    Get explanation of backtest performance metrics
 * @access  Private
 */
router.get('/metrics', backtestController.getMetricsExplanation);

export default router;