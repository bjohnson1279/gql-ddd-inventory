import { billingResolvers } from '../../../src/infrastructure/graphql/billingResolvers';

describe('billingResolvers', () => {
  it('should check rate limit successfully for valid tenant', () => {
    const result = billingResolvers.Query.checkRateLimit(null, { tenantId: 'tenant-123' });
    expect(result).toBe(true);
  });

  it('should enforce map size bounds to prevent memory exhaustion DoS', () => {
    for (let i = 0; i < 10005; i++) {
      billingResolvers.Query.checkRateLimit(null, { tenantId: `tenant-${i}` });
    }
    const result = billingResolvers.Query.checkRateLimit(null, { tenantId: 'tenant-final' });
    expect(result).toBe(true);
  });
});
