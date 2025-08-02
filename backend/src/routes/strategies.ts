import { Router } from 'express';
import { strategyController } from '@/controllers/StrategyController';
import { 
  authenticateToken, 
  requireEmailVerification,
  rateLimitByUser 
} from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/strategies
 * @desc    Create new strategy
 * @access  Private (requires email verification)
 */
router.post(
  '/',
  requireEmailVerification,
  rateLimitByUser(10, 60 * 60 * 1000), // 10 strategies per hour
  strategyController.createStrategy
);

/**
 * @route   GET /api/v1/strategies
 * @desc    Get all user strategies
 * @access  Private
 */
router.get('/', strategyController.getStrategies);

/**
 * @route   GET /api/v1/strategies/stats
 * @desc    Get strategy statistics
 * @access  Private
 */
router.get('/stats', strategyController.getStrategyStats);

/**
 * @route   GET /api/v1/strategies/:id
 * @desc    Get strategy by ID
 * @access  Private
 */
router.get('/:id', strategyController.getStrategy);

/**
 * @route   PUT /api/v1/strategies/:id
 * @desc    Update strategy
 * @access  Private
 */
router.put(
  '/:id',
  rateLimitByUser(20, 60 * 60 * 1000), // 20 updates per hour
  strategyController.updateStrategy
);

/**
 * @route   DELETE /api/v1/strategies/:id
 * @desc    Delete strategy
 * @access  Private
 */
router.delete(
  '/:id',
  rateLimitByUser(10, 60 * 60 * 1000), // 10 deletions per hour
  strategyController.deleteStrategy
);

/**
 * @route   POST /api/v1/strategies/:id/activate
 * @desc    Activate strategy
 * @access  Private
 */
router.post(
  '/:id/activate',
  rateLimitByUser(20, 60 * 60 * 1000), // 20 activations per hour
  strategyController.activateStrategy
);

/**
 * @route   POST /api/v1/strategies/:id/deactivate
 * @desc    Deactivate strategy
 * @access  Private
 */
router.post(
  '/:id/deactivate',
  rateLimitByUser(20, 60 * 60 * 1000), // 20 deactivations per hour
  strategyController.deactivateStrategy
);

/**
 * @route   GET /api/v1/strategies/:id/performance
 * @desc    Get strategy performance metrics
 * @access  Private
 */
router.get('/:id/performance', strategyController.getStrategyPerformance);

export default router;