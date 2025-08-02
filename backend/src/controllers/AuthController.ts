import { Request, Response } from 'express';
import { authService } from '@/services/AuthService';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import Joi from 'joi';

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long'
    })
});

const loginSchema = Joi.object({
  identifier: Joi.string()
    .required()
    .messages({
      'any.required': 'Email or username is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  newPassword: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'any.required': 'New password is required'
    })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required'
    })
});

export class AuthController {
  /**
   * Register a new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // Register user
      const result = await authService.register(value);

      if (result.success) {
        logger.info('User registration successful', { 
          username: result.user?.username,
          email: result.user?.email 
        });

        res.status(201).json({
          success: true,
          message: 'Registration successful',
          data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Registration controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // Login user
      const result = await authService.login(value);

      if (result.success) {
        logger.info('User login successful', { 
          username: result.user?.username 
        });

        res.status(200).json({
          success: true,
          message: 'Login successful',
          data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Login controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error } = refreshTokenSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // Refresh token (user is already validated by middleware)
      const result = await authService.refreshToken(req.user as any);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Refresh token controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await authService.getUserProfile(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            user: result.user
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
          code: 'USER_NOT_FOUND'
        });
      }

    } catch (error) {
      logger.error('Get profile controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Change user password
   */
  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // Change password
      const result = await authService.changePassword(req.user.id, value);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Password changed successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Change password controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Logout user (placeholder - in a real system you might blacklist the token)
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // In a stateless JWT system, logout is typically handled client-side
      // by removing the token. However, you could implement token blacklisting here.
      
      logger.info('User logged out', { userId: req.user.id });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Verify email (placeholder)
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { userId } = req.body;

      if (!token || !userId) {
        res.status(400).json({
          success: false,
          error: 'Token and user ID are required',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const result = await authService.verifyEmail(parseInt(userId), token);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Email verified successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Email verification controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Deactivate account
   */
  async deactivateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await authService.deactivateAccount(req.user.id);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Account deactivated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('Deactivate account controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

export const authController = new AuthController();