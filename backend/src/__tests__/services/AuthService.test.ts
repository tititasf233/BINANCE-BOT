import { AuthService } from '../../services/AuthService';
import { userModel } from '../../database/models/User';
import { CryptoUtils } from '../../utils/crypto';

// Mock dependencies
jest.mock('../../database/models/User');
jest.mock('../../utils/crypto');

const mockUserModel = userModel as jest.Mocked<typeof userModel>;
const mockCryptoUtils = CryptoUtils as jest.Mocked<typeof CryptoUtils>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'StrongPass123!'
    };

    it('should register user successfully', async () => {
      // Mock password validation
      mockCryptoUtils.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: []
      });

      // Mock user existence checks
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.findByUsername.mockResolvedValue(null);

      // Mock password hashing
      mockCryptoUtils.hashPassword.mockResolvedValue('hashed-password');

      // Mock user creation
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockUserModel.create.mockResolvedValue(mockUser);

      // Mock token generation
      mockCryptoUtils.generateAccessToken.mockReturnValue('access-token');
      mockCryptoUtils.generateRefreshToken.mockReturnValue('refresh-token');

      const result = await authService.register(registerData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should reject weak password', async () => {
      mockCryptoUtils.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password too weak']
      });

      const result = await authService.register(registerData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password too weak');
      expect(result.code).toBe('AUTH_WEAK_PASSWORD');
    });

    it('should reject existing email', async () => {
      mockCryptoUtils.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: []
      });

      const existingUser = {
        id: 1,
        username: 'existinguser',
        email: 'test@example.com',
        password_hash: 'hash',
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockUserModel.findByEmail.mockResolvedValue(existingUser);

      const result = await authService.register(registerData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(result.code).toBe('AUTH_EMAIL_EXISTS');
    });
  });

  describe('login', () => {
    const loginData = {
      identifier: 'test@example.com',
      password: 'StrongPass123!'
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserModel.findByEmailOrUsername.mockResolvedValue(mockUser);
      mockCryptoUtils.verifyPassword.mockResolvedValue(true);
      mockCryptoUtils.generateAccessToken.mockReturnValue('access-token');
      mockCryptoUtils.generateRefreshToken.mockReturnValue('refresh-token');

      const result = await authService.login(loginData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should reject invalid credentials', async () => {
      mockUserModel.findByEmailOrUsername.mockResolvedValue(null);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('should reject inactive user', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        is_active: false,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserModel.findByEmailOrUsername.mockResolvedValue(mockUser);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account deactivated');
      expect(result.code).toBe('AUTH_ACCOUNT_DEACTIVATED');
    });

    it('should reject wrong password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserModel.findByEmailOrUsername.mockResolvedValue(mockUser);
      mockCryptoUtils.verifyPassword.mockResolvedValue(false);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('changePassword', () => {
    const passwordData = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!'
    };

    it('should change password successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'old-hashed-password',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockCryptoUtils.verifyPassword.mockResolvedValue(true);
      mockCryptoUtils.validatePasswordStrength.mockReturnValue({
        isValid: true,
        errors: []
      });
      mockCryptoUtils.hashPassword.mockResolvedValue('new-hashed-password');
      mockUserModel.updatePassword.mockResolvedValue(true);

      const result = await authService.changePassword(1, passwordData);

      expect(result.success).toBe(true);
      expect(mockUserModel.updatePassword).toHaveBeenCalledWith(1, 'new-hashed-password');
    });

    it('should reject incorrect current password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'old-hashed-password',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockCryptoUtils.verifyPassword.mockResolvedValue(false);

      const result = await authService.changePassword(1, passwordData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
      expect(result.code).toBe('AUTH_INVALID_CURRENT_PASSWORD');
    });
  });
});