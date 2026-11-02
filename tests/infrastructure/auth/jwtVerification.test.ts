import jwt from 'jsonwebtoken';

describe('JWT algorithm enforcement', () => {
  const secret = 'fallback-jwt-secret-key-123!';
  const payload = {
    tenantId: 'tenant-test',
    actorId: 'user-test',
    role: 'admin',
  };

  it('should accept valid tokens signed with HS256 algorithm', () => {
    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as typeof payload;

    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.actorId).toBe(payload.actorId);
    expect(decoded.role).toBe(payload.role);
  });

  it('should reject tokens signed with an unauthorized algorithm', () => {
    // Generate token signed with HS384 instead of HS256
    const token = jwt.sign(payload, secret, { algorithm: 'HS384' });

    expect(() => {
      jwt.verify(token, secret, { algorithms: ['HS256'] });
    }).toThrow(/invalid algorithm/);
  });

  it('should reject tokens with algorithm set to none or tampered headers', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const forgedToken = `${header}.${body}.`;

    expect(() => {
      jwt.verify(forgedToken, secret, { algorithms: ['HS256'] });
    }).toThrow();
  });
});
