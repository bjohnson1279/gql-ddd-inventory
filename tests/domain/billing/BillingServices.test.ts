import { TenantBillingTier, TierName, ApiUsageRecord, BillingEventType } from '../../../src/domain/billing/BillingEntities';
import { RateLimitingService, UsageMeteringService, BillingHookService } from '../../../src/domain/billing/BillingServices';

describe('Billing Services', () => {
  it('RateLimitingService handles token bucket correctly', () => {
    const service = new RateLimitingService();
    const tier: TenantBillingTier = {
      tierName: TierName.FREE, maxRequestsPerMinute: 60, maxActiveSkus: 100, includedApiRequestsPerMonth: 1000, baseMonthlyPriceCents: 0
    };
    
    const now = Date.now() / 1000;
    const r1 = service.allowRequest(tier, 60.0, now, now);
    expect(r1.isAllowed).toBe(true);
    expect(r1.newTokens).toBe(59.0);
    
    const r2 = service.allowRequest(tier, 0.0, now, now);
    expect(r2.isAllowed).toBe(false);
    
    const r3 = service.allowRequest(tier, 0.0, now, now + 1.0);
    expect(r3.isAllowed).toBe(true);
    expect(r3.newTokens).toBe(0.0);
  });

  it('BillingHookService generates overage events', () => {
    const service = new BillingHookService();
    const tier: TenantBillingTier = {
      tierName: TierName.PRO, maxRequestsPerMinute: 60, maxActiveSkus: 100, includedApiRequestsPerMonth: 1000, baseMonthlyPriceCents: 0
    };
    
    const record = new ApiUsageRecord("T1", "2026-10", 1500, 0, 150);
    const events = service.evaluateOverages(record, tier, new Date());
    
    expect(events.length).toBe(2);
    
    const apiEvent = events.find(e => e.eventType === BillingEventType.API_OVERAGE);
    expect(apiEvent?.quantity).toBe(500);
    
    const skuEvent = events.find(e => e.eventType === BillingEventType.NEW_SKU_TIER);
    expect(skuEvent?.quantity).toBe(50);
  });
});
