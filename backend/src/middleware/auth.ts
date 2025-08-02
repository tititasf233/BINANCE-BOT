import { Request, Response, NextFunction } from 'express';
import { CryptoUtils, JWTPayload } from '@/utils/crypto';
import { userModel } from '@/database/models/User';
import { logger } from '@/utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        isActive: boolean;
        emailVerified: boolean;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: NonNullable<Request['user']>;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'AUTH_001'
      });
      return;
    }

    // Verify token
    const decoded: JWTPayload = CryptoUtils.verifyToken(token);

    // Check if it's an access token
    if (decoded.type !== 'access') {
      res.status(401).json({
        success: false,
        error: 'Invalid token type',
        code: 'AUTH_002'
      });
      return;
    }

    // Get user from database
    const user = await userModel.findById(decoded.userId);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'AUTH_003'
      });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({
        success: false,
        error: 'Account deactivated',
        code: 'AUTH_004'
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id!,
      username: user.username,
      email: user.email,
      isActive: user.is_active,
      emailVerified: user.email_verified
    };

    logger.debug('User authenticated successfully', { 
      userId: user.id, 
      username: user.username 
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'AUTH_005'
        });
        return;
      } else if (error.message === 'Invalid token') {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'AUTH_006'
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_007'
    });
  }
};

/**
 * Middleware to require email verification
 */
export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user.emailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'AUTH_008'
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user is admin (placeholder for future role system)
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // For now, we'll implement a simple admin check
  // In the future, this should check user roles from database
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
  
  if (!adminEmails.includes(req.user.email)) {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'AUTH_009'
    });
    return;
  }

  next();
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const decoded: JWTPayload = CryptoUtils.verifyToken(token);
    
    if (decoded.type === 'access') {
      const user = await userModel.findById(decoded.userId);
      
      if (user && user.is_active) {
        req.user = {
          id: user.id!,
          username: user.username,
          email: user.email,
          isActive: user.is_active,
          emailVerified: user.email_verified
        };
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed:', error);
    next();
  }
};

/**
 * Rate limiting by user ID
 */
export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const userRequests = new Map<number, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user.id;
    const now = Date.now();
    
    const userLimit = userRequests.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize user limit
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (userLimit.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'AUTH_010',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
      return;
    }

    userLimit.count++;
    next();
  };
};

/**
 * Middleware to validate refresh token
 */
export const validateRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token required',
        code: 'AUTH_011'
      });
      return;
    }

    const decoded: JWTPayload = CryptoUtils.verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'AUTH_012'
      });
      return;
    }

    const user = await userModel.findById(decoded.userId);
    
    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'AUTH_013'
      });
      return;
    }

    req.user = {
      id: user.id!,
      username: user.username,
      email: user.email,
      isActive: user.is_active,
      emailVerified: user.email_verified
    };

    next();
  } catch (error) {
    logger.error('Refresh token validation error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
      code: 'AUTH_014'
    });
  }
};