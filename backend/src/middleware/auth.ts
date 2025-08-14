import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    const decoded = jwt.verify(token, secret) as any;
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
};

export const generateToken = (user: { id: string; email: string; role?: string }) => {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role || 'user' 
    },
    secret,
    { expiresIn }
  );
};

export const generateRefreshToken = (user: { id: string; email: string }) => {
  const secret = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  
  return jwt.sign(
    { id: user.id, email: user.email },
    secret,
    { expiresIn }
  );
};