import { Router } from 'express';
import { authController } from '@/controllers/AuthController';
import { 
  authenticateToken, 
  validateRefreshToken,
  rateLimitByUser 
} from '@/middleware/auth';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires valid refresh token)
 */
router.post('/refresh', validateRefreshToken, authController.refreshToken);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, authController.getProfile);

/**
 * @route   PUT /api/v1/auth/password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/password', 
  authenticateToken, 
  rateLimitByUser(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  authController.changePassword
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   POST /api/v1/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
router.post('/verify-email/:token', authController.verifyEmail);

/**
 * @route   DELETE /api/v1/auth/account
 * @desc    Deactivate user account
 * @access  Private
 */
router.delete(
  '/account', 
  authenticateToken,
  rateLimitByUser(3, 60 * 60 * 1000), // 3 attempts per hour
  authController.deactivateAccount
);

export default router;