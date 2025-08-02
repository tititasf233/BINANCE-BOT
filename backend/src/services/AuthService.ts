import { userModel, UserFields } from '@/database/models/User';
import { CryptoUtils } from '@/utils/crypto';
import { logger } from '@/utils/logger';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  identifier: string; // email or username
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    email: string;
    emailVerified: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  code?: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const { username, email, password } = data;

      // Validate password strength
      const passwordValidation = CryptoUtils.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.errors.join(', '),
          code: 'AUTH_WEAK_PASSWORD'
        };
      }

      // Check if user already exists
      const existingUserByEmail = await userModel.findByEmail(email);
      if (existingUserByEmail) {
        return {
          success: false,
          error: 'Email already registered',
          code: 'AUTH_EMAIL_EXISTS'
        };
      }

      const existingUserByUsername = await userModel.findByUsername(username);
      if (existingUserByUsername) {
        return {
          success: false,
          error: 'Username already taken',
          code: 'AUTH_USERNAME_EXISTS'
        };
      }

      // Hash password
      const passwordHash = await CryptoUtils.hashPassword(password);

      // Create user
      const newUser = await userModel.create({
        username,
        email,
        password_hash: passwordHash,
        is_active: true,
        email_verified: false
      });

      logger.info('New user registered', { 
        userId: newUser.id, 
        username: newUser.username,
        email: newUser.email 
      });

      // Generate tokens
      const tokenPayload = {
        userId: newUser.id!,
        username: newUser.username,
        email: newUser.email
      };

      const accessToken = CryptoUtils.generateAccessToken(tokenPayload);
      const refreshToken = CryptoUtils.generateRefreshToken(tokenPayload);

      return {
        success: true,
        user: {
          id: newUser.id!,
          username: newUser.username,
          email: newUser.email,
          emailVerified: newUser.email_verified
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed',
        code: 'AUTH_REGISTRATION_FAILED'
      };
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const { identifier, password } = data;

      // Find user by email or username
      const user = await userModel.findByEmailOrUsername(identifier);
      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_INVALID_CREDENTIALS'
        };
      }

      // Check if user is active
      if (!user.is_active) {
        return {
          success: false,
          error: 'Account deactivated',
          code: 'AUTH_ACCOUNT_DEACTIVATED'
        };
      }

      // Verify password
      const isPasswordValid = await CryptoUtils.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid credentials',
          code: 'AUTH_INVALID_CREDENTIALS'
        };
      }

      logger.info('User logged in', { 
        userId: user.id, 
        username: user.username 
      });

      // Generate tokens
      const tokenPayload = {
        userId: user.id!,
        username: user.username,
        email: user.email
      };

      const accessToken = CryptoUtils.generateAccessToken(tokenPayload);
      const refreshToken = CryptoUtils.generateRefreshToken(tokenPayload);

      return {
        success: true,
        user: {
          id: user.id!,
          username: user.username,
          email: user.email,
          emailVerified: user.email_verified
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed',
        code: 'AUTH_LOGIN_FAILED'
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(user: UserFields): Promise<AuthResponse> {
    try {
      // Generate new tokens
      const tokenPayload = {
        userId: user.id!,
        username: user.username,
        email: user.email
      };

      const accessToken = CryptoUtils.generateAccessToken(tokenPayload);
      const refreshToken = CryptoUtils.generateRefreshToken(tokenPayload);

      logger.debug('Tokens refreshed', { userId: user.id });

      return {
        success: true,
        user: {
          id: user.id!,
          username: user.username,
          email: user.email,
          emailVerified: user.email_verified
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Token refresh failed',
        code: 'AUTH_REFRESH_FAILED'
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: number, data: PasswordChangeData): Promise<AuthResponse> {
    try {
      const { currentPassword, newPassword } = data;

      // Get user
      const user = await userModel.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          code: 'AUTH_USER_NOT_FOUND'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await CryptoUtils.verifyPassword(
        currentPassword, 
        user.password_hash
      );
      
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: 'Current password is incorrect',
          code: 'AUTH_INVALID_CURRENT_PASSWORD'
        };
      }

      // Validate new password strength
      const passwordValidation = CryptoUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.errors.join(', '),
          code: 'AUTH_WEAK_PASSWORD'
        };
      }

      // Hash new password
      const newPasswordHash = await CryptoUtils.hashPassword(newPassword);

      // Update password
      await userModel.updatePassword(userId, newPasswordHash);

      logger.info('Password changed', { userId });

      return {
        success: true
      };

    } catch (error) {
      logger.error('Password change error:', error);
      return {
        success: false,
        error: 'Password change failed',
        code: 'AUTH_PASSWORD_CHANGE_FAILED'
      };
    }
  }

  /**
   * Verify email (placeholder for future implementation)
   */
  async verifyEmail(userId: number, token: string): Promise<AuthResponse> {
    try {
      // This is a placeholder implementation
      // In a real system, you'd verify the token and update the user's email_verified status
      
      const success = await userModel.verifyEmail(userId);
      
      if (success) {
        logger.info('Email verified', { userId });
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Email verification failed',
          code: 'AUTH_EMAIL_VERIFICATION_FAILED'
        };
      }

    } catch (error) {
      logger.error('Email verification error:', error);
      return {
        success: false,
        error: 'Email verification failed',
        code: 'AUTH_EMAIL_VERIFICATION_FAILED'
      };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: number): Promise<{
    success: boolean;
    user?: {
      id: number;
      username: string;
      email: string;
      emailVerified: boolean;
      createdAt: Date;
    };
    error?: string;
  }> {
    try {
      const user = await userModel.findById(userId);
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return {
        success: true,
        user: {
          id: user.id!,
          username: user.username,
          email: user.email,
          emailVerified: user.email_verified,
          createdAt: user.created_at!
        }
      };

    } catch (error) {
      logger.error('Get user profile error:', error);
      return {
        success: false,
        error: 'Failed to get user profile'
      };
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: number): Promise<AuthResponse> {
    try {
      const success = await userModel.deactivateUser(userId);
      
      if (success) {
        logger.info('Account deactivated', { userId });
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Account deactivation failed',
          code: 'AUTH_DEACTIVATION_FAILED'
        };
      }

    } catch (error) {
      logger.error('Account deactivation error:', error);
      return {
        success: false,
        error: 'Account deactivation failed',
        code: 'AUTH_DEACTIVATION_FAILED'
      };
    }
  }
}

export const authService = new AuthService();