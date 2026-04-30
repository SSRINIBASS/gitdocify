import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  validateEmail,
  validateUrl,
  validateGithubUrl,
  validateRepoId,
  validateSearchQuery
} from '../inputValidation';

describe('Input Validation Utilities', () => {
  
  describe('sanitizeInput', () => {
    it('sanitizes HTML tags', () => {
      expect(sanitizeInput('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });
    
    it('handles non-string inputs safely', () => {
      // @ts-ignore testing invalid input
      expect(sanitizeInput(null)).toBe('');
      // @ts-ignore
      expect(sanitizeInput(123)).toBe('');
    });
  });

  describe('validateEmail', () => {
    it('returns true for valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('returns false for invalid emails', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('returns true for valid URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://')).toBe(false); // Valid URI but we might want to check for http/https in the future, for now new URL() passes this. Wait, new URL('ftp://') throws or not? Actually new URL('ftp://test.com') is valid.
    });
  });

  describe('validateGithubUrl', () => {
    it('returns true for valid github URLs', () => {
      expect(validateGithubUrl('https://github.com/owner/repo')).toBe(true);
      expect(validateGithubUrl('http://www.github.com/owner/repo')).toBe(true);
    });

    it('returns false for non-github URLs', () => {
      expect(validateGithubUrl('https://gitlab.com/owner/repo')).toBe(false);
      expect(validateGithubUrl('not-a-url')).toBe(false);
    });
  });

  describe('validateRepoId', () => {
    it('returns true for valid UUIDs', () => {
      expect(validateRepoId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('returns false for invalid UUIDs', () => {
      expect(validateRepoId('123-456')).toBe(false);
      expect(validateRepoId('invalid-uuid')).toBe(false);
    });
  });

  describe('validateSearchQuery', () => {
    it('validates good queries', () => {
      expect(validateSearchQuery('react hooks').valid).toBe(true);
    });

    it('rejects short queries', () => {
      expect(validateSearchQuery('a').valid).toBe(false);
      expect(validateSearchQuery(' ').valid).toBe(false);
    });

    it('rejects overly long queries', () => {
      const longQuery = 'a'.repeat(1001);
      expect(validateSearchQuery(longQuery).valid).toBe(false);
    });
  });
});
