import { Router } from 'express';
import { portfolioController } from '@/controllers/PortfolioController';
import { 
  authenticateToken, 
  rateLimitByUser 
} from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/v1/portfolio/overview
 * @desc    Get portfolio overview with balances and performance
 * @access  Private
 */
router.get('/overview', portfolioController.getOverview);

/**
 * @route   GET /api/v1/portfolio/positions
 * @desc    Get open positions with current prices and PnL
 * @access  Private
 */
router.get('/positions', portfolioController.getOpenPositions);

/**
 * @route   GET /api/v1/portfolio/pnl
 * @desc    Get daily PnL history
 * @access  Private
 * @query   days - Number of days to retrieve (default: 30, max: 365)
 */
router.get('/pnl', portfolioController.getDailyPnL);

/**
 * @route   GET /api/v1/portfolio/allocation
 * @desc    Get portfolio allocation by strategy
 * @access  Private
 */
router.get('/allocation', portfolioController.getStrategyAllocation);

/**
 * @route   GET /api/v1/portfolio/stats
 * @desc    Get portfolio statistics
 * @access  Private
 */
router.get('/stats', portfolioController.getStats);

/**
 * @route   GET /api/v1/portfolio/performance
 * @desc    Get comprehensive performance summary
 * @access  Private
 */
router.get('/performance', portfolioController.getPerformanceSummary);

/**
 * @route   GET /api/v1/portfolio/balance
 * @desc    Get balance breakdown by asset
 * @access  Private
 */
router.get('/balance', portfolioController.getBalanceBreakdown);

/**
 * @route   POST /api/v1/portfolio/refresh
 * @desc    Refresh portfolio data (clear cache)
 * @access  Private
 */
router.post(
  '/refresh',
  rateLimitByUser(10, 60 * 60 * 1000), // 10 refreshes per hour
  portfolioController.refreshData
);

export default router;