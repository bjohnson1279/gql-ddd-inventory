import { RateLimitingService } from '../../domain/billing/BillingServices';
import { TierName } from '../../domain/billing/BillingEntities';

const rateLimiter = new RateLimitingService();
const memoryTokens = new Map<string, { tokens: number, lastRefill: number }>();

export const billingResolvers = {
  Query: {
    checkRateLimit: (_: any, args: { tenantId: string }) => {
      const now = Date.now() / 1000;
      const state = memoryTokens.get(args.tenantId) || { tokens: 60, lastRefill: now };
      
      const tier = {
        tierName: TierName.FREE,
        maxRequestsPerMinute: 60,
        maxActiveSkus: 100,
        includedApiRequestsPerMonth: 1000,
        baseMonthlyPriceCents: 0
      };

      const result = rateLimiter.allowRequest(tier, state.tokens, state.lastRefill, now);
      
      memoryTokens.set(args.tenantId, {
        tokens: result.newTokens,
        lastRefill: result.newLastRefillTime
      });

      return result.isAllowed;
    }
  }
};
