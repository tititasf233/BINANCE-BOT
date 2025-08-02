import { CryptoUtils } from '../../utils/crypto';

describe('CryptoUtils', () => {
  describe('password hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123!';
      const hash = await CryptoUtils.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify password correctly', async () => {
      const password = 'testPassword123!';
      const hash = await CryptoUtils.hashPassword(password);
      
      const isValid = await CryptoUtils.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await CryptoUtils.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const payload = {
      userId: 1,
      username: 'testuser',
      email: 'test@example.com'
    };

    it('should generate and verify access token', () => {
      const token = CryptoUtils.generateAccessToken(payload);
      expect(token).toBeDefined();
      
      const decoded = CryptoUtils.verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.type).toBe('access');
    });

    it('should generate and verify refresh token', () => {
      const token = CryptoUtils.generateRefreshToken(payload);
      expect(token).toBeDefined();
      
      const decoded = CryptoUtils.verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        CryptoUtils.verifyToken('invalid.token.here');
      }).toThrow();
    });
  });

  describe('password validation', () => {
    it('should validate strong password', () => {
      const result = CryptoUtils.validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoNumbers!',
        'NoSpecialChars123'
      ];

      weakPasswords.forEach(password => {
        const result = CryptoUtils.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('encryption/decryption', () => {
    const testData = 'sensitive-api-key-data';
    const testKey = 'test-encryption-key-32-characters';

    it('should encrypt and decrypt data correctly', () => {
      const encrypted = CryptoUtils.encrypt(testData, testKey);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      
      const decrypted = CryptoUtils.decrypt(encrypted.encrypted, encrypted.iv, testKey);
      expect(decrypted).toBe(testData);
    });
  });

  describe('utility functions', () => {
    it('should generate random string', () => {
      const str1 = CryptoUtils.generateRandomString(16);
      const str2 = CryptoUtils.generateRandomString(16);
      
      expect(str1).toBeDefined();
      expect(str2).toBeDefined();
      expect(str1).not.toBe(str2);
      expect(str1.length).toBe(32); // hex encoding doubles length
    });

    it('should generate API key', () => {
      const apiKey = CryptoUtils.generateApiKey();
      expect(apiKey).toMatch(/^aura_[a-z0-9]+_[a-f0-9]+$/);
    });

    it('should create and verify HMAC signature', () => {
      const data = 'test data';
      const secret = 'test secret';
      
      const signature = CryptoUtils.createHmacSignature(data, secret);
      expect(signature).toBeDefined();
      
      const isValid = CryptoUtils.verifyHmacSignature(data, signature, secret);
      expect(isValid).toBe(true);
      
      const isInvalid = CryptoUtils.verifyHmacSignature('wrong data', signature, secret);
      expect(isInvalid).toBe(false);
    });
  });
});