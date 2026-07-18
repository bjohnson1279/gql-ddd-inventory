import { hashPassword, verifyPassword, verifyPasswordSafe } from '../../../src/infrastructure/utils/security';

describe('security utils', () => {
  describe('hashPassword', () => {
    it('should generate a valid hash with a salt', () => {
      const password = 'my-secret-password';
      const storedHash = hashPassword(password);

      expect(storedHash).toBeDefined();
      expect(typeof storedHash).toBe('string');

      const [salt, hash] = storedHash.split(':');
      expect(salt).toBeDefined();
      expect(hash).toBeDefined();
    });

    it('should generate different hashes for the same password due to random salt', () => {
      const password = 'my-secret-password';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for a correct password', () => {
      const password = 'my-secret-password';
      const storedHash = hashPassword(password);

      expect(verifyPassword(password, storedHash)).toBe(true);
    });

    it('should return false for an incorrect password', () => {
      const password = 'my-secret-password';
      const wrongPassword = 'wrong-password';
      const storedHash = hashPassword(password);

      expect(verifyPassword(wrongPassword, storedHash)).toBe(false);
    });

    it('should return false for an invalid storedHash format', () => {
      const password = 'my-secret-password';

      expect(verifyPassword(password, 'invalid-hash')).toBe(false);
      expect(verifyPassword(password, ':hash-without-salt')).toBe(false);
      expect(verifyPassword(password, 'salt-without-hash:')).toBe(false);
      expect(verifyPassword(password, ':')).toBe(false);
    });

    it('should return false if hash lengths do not match', () => {
        const password = 'my-secret-password';
        const storedHash = hashPassword(password);
        const [salt, hash] = storedHash.split(':');

        const tamperedHash = hash.slice(0, -2);
        const tamperedStoredHash = `${salt}:${tamperedHash}`;

        expect(verifyPassword(password, tamperedStoredHash)).toBe(false);
    });

    it('should handle unexpected runtime types for password', () => {
      const password = 'my-secret-password';
      const storedHash = hashPassword(password);

      expect(verifyPassword(null as any, storedHash)).toBe(false);
      expect(verifyPassword(undefined as any, storedHash)).toBe(false);
      expect(verifyPassword(123 as any, storedHash)).toBe(false);
      expect(verifyPassword({} as any, storedHash)).toBe(false);
      expect(verifyPassword([] as any, storedHash)).toBe(false);
    });

    it('should handle unexpected runtime types for storedHash', () => {
      const password = 'my-secret-password';

      expect(verifyPassword(password, null as any)).toBe(false);
      expect(verifyPassword(password, undefined as any)).toBe(false);
      expect(verifyPassword(password, 123 as any)).toBe(false);
      expect(verifyPassword(password, {} as any)).toBe(false);
      expect(verifyPassword(password, [] as any)).toBe(false);
    });
  });

  describe('verifyPasswordSafe', () => {
    it('should return true for a correct password', () => {
      const password = 'my-secret-password';
      const storedHash = hashPassword(password);

      expect(verifyPasswordSafe(password, storedHash)).toBe(true);
    });

    it('should return false for an incorrect password', () => {
      const password = 'my-secret-password';
      const wrongPassword = 'wrong-password';
      const storedHash = hashPassword(password);

      expect(verifyPasswordSafe(wrongPassword, storedHash)).toBe(false);
    });

    it('should return false and verify against dummy hash when storedHash is missing', () => {
      const password = 'my-secret-password';

      expect(verifyPasswordSafe(password, null)).toBe(false);
      expect(verifyPasswordSafe(password, undefined)).toBe(false);
      expect(verifyPasswordSafe(password, '')).toBe(false);
    });
  });
});
