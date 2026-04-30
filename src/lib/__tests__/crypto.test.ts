import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskApiKey } from '../crypto';

describe('Crypto Utilities', () => {
  it('encrypts and decrypts a string successfully', () => {
    const original = 'my-super-secret-api-key';
    const encrypted = encrypt(original);
    
    expect(encrypted).not.toBe(original);
    expect(encrypted.length).toBeGreaterThan(0);
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const original = 'same-plaintext';
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);
    
    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(original);
    expect(decrypt(encrypted2)).toBe(original);
  });

  it('throws an error if decryption is tampered with', () => {
    const original = 'test-data';
    const encrypted = encrypt(original);
    
    // Change a character in the middle
    const tampered = encrypted.substring(0, 10) + (encrypted[10] === 'A' ? 'B' : 'A') + encrypted.substring(11);
    
    expect(() => decrypt(tampered)).toThrow();
  });

  describe('maskApiKey', () => {
    it('masks a standard API key correctly', () => {
      expect(maskApiKey('AIzaSyB1234567890abcdefghijklmnopqrstuv')).toBe('AIza...stuv');
    });

    it('masks short keys heavily', () => {
      expect(maskApiKey('shortkey')).toBe('****');
      expect(maskApiKey('12345')).toBe('****');
    });
  });
});
