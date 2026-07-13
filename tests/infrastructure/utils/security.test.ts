import { hashPassword, verifyPassword } from '../../../src/infrastructure/utils/security';

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
  });
});
