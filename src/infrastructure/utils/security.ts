import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Dummy hash to perform timing-safe operations even if user doesn't exist
const DUMMY_HASH = '884cf3d1767e7d871e882e341133d7c3:bb2e4bbcb10e6f9d0495faf857119a1f0912be9f3d090ce9dd7a2833cf34ef59196c040719f1f044ba4fb9a8d7552a1e8fdf7f741bcf25b63dccbd16ce966ed1';

export function verifyPasswordSafe(password: string, storedHash?: string | null): boolean {
  if (!storedHash) {
    // Verify against dummy hash to mitigate timing attacks for non-existent users
    verifyPassword(password, DUMMY_HASH);
    return false;
  }
  return verifyPassword(password, storedHash);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const verifyHashBuffer = Buffer.from(verifyHash, 'hex');

    if (hashBuffer.length !== verifyHashBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, verifyHashBuffer);
  } catch (error) {
    return false;
  }
}
