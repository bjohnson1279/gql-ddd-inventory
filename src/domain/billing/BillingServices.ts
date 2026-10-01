import { v4 as uuidv4 } from 'uuid';
import { 
  TenantBillingTier, ApiUsageRecord, BillingEvent, BillingEventType 
} from './BillingEntities';

export class RateLimitingService {
  public allowRequest(
    tier: TenantBillingTier,
    currentTokens: number,
    lastRefillTime: number,
    currentTime: number = Date.now() / 1000
  ): { isAllowed: boolean; newTokens: number; newLastRefillTime: number } {
    const capacity = tier.maxRequestsPerMinute;
    const refillRate = capacity / 60.0;
    
    const elapsed = Math.max(0, currentTime - lastRefillTime);
    const tokensToAdd = elapsed * refillRate;
    
    let newTokens = Math.min(capacity, currentTokens + tokensToAdd);
    
    if (newTokens >= 1.0) {
      return { isAllowed: true, newTokens: newTokens - 1.0, newLastRefillTime: currentTime };
    } else {
      return { isAllowed: false, newTokens, newLastRefillTime: currentTime };
    }
  }
}

export class UsageMeteringService {
  public incrementApiUsage(record: ApiUsageRecord): void {
    record.apiRequestsCount += 1;
  }
  
  public recordStorageUsage(record: ApiUsageRecord, bytesUsed: number): void {
    if (bytesUsed > record.storageBytesUsed) {
      record.storageBytesUsed = bytesUsed;
    }
  }
  
  public updateActiveSkus(record: ApiUsageRecord, skuCount: number): void {
    record.activeSkusCount = skuCount;
  }
}

export class BillingHookService {
  public evaluateOverages(
    record: ApiUsageRecord,
    tier: TenantBillingTier,
    currentTime: Date = new Date()
  ): BillingEvent[] {
    const events: BillingEvent[] = [];
    
    if (record.apiRequestsCount > tier.includedApiRequestsPerMonth) {
      const overage = record.apiRequestsCount - tier.includedApiRequestsPerMonth;
      events.push({
        eventId: uuidv4(),
        tenantId: record.tenantId,
        eventType: BillingEventType.API_OVERAGE,
        quantity: overage,
        occurredAt: currentTime
      });
    }
    
    if (record.activeSkusCount > tier.maxActiveSkus) {
      const overage = record.activeSkusCount - tier.maxActiveSkus;
      events.push({
        eventId: uuidv4(),
        tenantId: record.tenantId,
        eventType: BillingEventType.NEW_SKU_TIER,
        quantity: overage,
        occurredAt: currentTime
      });
    }
    
    return events;
  }
}
