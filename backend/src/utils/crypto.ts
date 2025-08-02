import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from './logger';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Password hashing configuration
const SALT_ROUNDS = 12;

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export class CryptoUtils {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      logger.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw new Error('Failed to verify password');
    }
  }

  /**
   * Generate JWT access token
   */
  static generateAccessToken(payload: Omit<JWTPayload, 'type'>): string {
    try {
      const tokenPayload: JWTPayload = {
        ...payload,
        type: 'access'
      };

      return jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'aura-trading-system',
        audience: 'aura-users'
      });
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(payload: Omit<JWTPayload, 'type'>): string {
    try {
      const tokenPayload: JWTPayload = {
        ...payload,
        type: 'refresh'
      };

      return jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'aura-trading-system',
        audience: 'aura-users'
      });
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'aura-trading-system',
        audience: 'aura-users'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        logger.error('Error verifying token:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Generate random string for various purposes
   */
  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure API key
   */
  static generateApiKey(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(16).toString('hex');
    return `aura_${timestamp}_${randomPart}`;
  }

  /**
   * Create HMAC signature
   */
  static createHmacSignature(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHmacSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHmacSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt sensitive data (for API keys)
   */
  static encrypt(text: string, key?: string): { encrypted: string; iv: string } {
    try {
      const encryptionKey = key || process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Encryption key not provided');
      }

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', encryptionKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted + ':' + authTag.toString('hex'),
        iv: iv.toString('hex')
      };
    } catch (error) {
      logger.error('Error encrypting data:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data (for API keys)
   */
  static decrypt(encryptedData: string, iv: string, key?: string): string {
    try {
      const encryptionKey = key || process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Encryption key not provided');
      }

      const [encrypted, authTag] = encryptedData.split(':');
      const decipher = crypto.createDecipher('aes-256-gcm', encryptionKey);
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting data:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(): {
    token: string;
    hashedToken: string;
    expiresAt: Date;
  } {
    const token = this.generateRandomString(32);
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    return {
      token,
      hashedToken,
      expiresAt
    };
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default CryptoUtils;