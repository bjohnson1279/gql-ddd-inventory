import jwt from 'jsonwebtoken';

describe('JWT Algorithm Verification Security', () => {
  const secret = 'test-secret';

  it('should accept tokens signed with allowed HS256 algorithm', () => {
    const payload = { tenantId: 'tenant-1', actorId: 'user-1', role: 'admin' };
    const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
    const verified = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
    expect(verified.tenantId).toBe('tenant-1');
    expect(verified.actorId).toBe('user-1');
  });

  it('should reject tokens signed with none algorithm', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ tenantId: 'tenant-1', actorId: 'user-1', role: 'admin' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    expect(() => {
      jwt.verify(noneToken, secret, { algorithms: ['HS256'] });
    }).toThrow();
  });

  it('should reject tokens signed with disallowed algorithm such as HS512 when only HS256 is allowed', () => {
    const payload = { tenantId: 'tenant-1', actorId: 'user-1', role: 'admin' };
    const token = jwt.sign(payload, secret, { algorithm: 'HS512', expiresIn: '1h' });

    expect(() => {
      jwt.verify(token, secret, { algorithms: ['HS256'] });
    }).toThrow(/invalid algorithm/i);
  });
});
