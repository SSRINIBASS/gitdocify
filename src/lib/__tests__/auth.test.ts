import { describe, it, expect } from 'vitest';
import {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
  extractToken,
  validatePassword
} from '../auth';

describe('Auth Utilities', () => {
  describe('JWT Operations', () => {
    it('signs and verifies a token successfully', async () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = await signToken(payload);
      
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // Header, Payload, Signature
      
      const decoded = await verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('fails to verify an invalid token', async () => {
      await expect(verifyToken('invalid.token.string')).rejects.toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('hashes passwords and verifies them', async () => {
      const password = 'SuperSecret123!';
      const hash = await hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$')).toBe(true); // bcrypt signature
      
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await comparePassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('extractToken', () => {
    it('extracts token from Authorization header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'Authorization': 'Bearer test-token-123'
        }
      });
      expect(extractToken(request)).toBe('test-token-123');
    });

    it('extracts token from Cookie header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'Cookie': 'other=abc; token=test-token-456; more=xyz'
        }
      });
      expect(extractToken(request)).toBe('test-token-456');
    });

    it('returns null if no token is present', () => {
      const request = new Request('http://localhost');
      expect(extractToken(request)).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('accepts strong passwords', () => {
      expect(validatePassword('StrongPass123!').valid).toBe(true);
    });

    it('rejects weak passwords', () => {
      expect(validatePassword('short').valid).toBe(false); // < 8 chars
      expect(validatePassword('alllowercase123!').valid).toBe(false); // no uppercase
      expect(validatePassword('ALLUPPERCASE123!').valid).toBe(false); // no lowercase
      expect(validatePassword('NoNumbersHere!').valid).toBe(false); // no number
      expect(validatePassword('NoSpecialChar123').valid).toBe(false); // no special char
    });
  });
});
