export enum TierName {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

export enum BillingEventType {
  API_OVERAGE = 'API_OVERAGE',
  STORAGE_OVERAGE = 'STORAGE_OVERAGE',
  NEW_SKU_TIER = 'NEW_SKU_TIER'
}

export interface TenantBillingTier {
  tierName: TierName;
  maxRequestsPerMinute: number;
  maxActiveSkus: number;
  includedApiRequestsPerMonth: number;
  baseMonthlyPriceCents: number;
}

export class ApiUsageRecord {
  constructor(
    public tenantId: string,
    public billingCycleId: string,
    public apiRequestsCount: number,
    public storageBytesUsed: number,
    public activeSkusCount: number
  ) {}
}

export interface BillingEvent {
  eventId: string;
  tenantId: string;
  eventType: BillingEventType;
  quantity: number;
  occurredAt: Date;
}
