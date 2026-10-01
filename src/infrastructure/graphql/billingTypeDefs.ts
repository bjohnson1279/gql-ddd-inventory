import { gql } from 'apollo-server-express';

export const billingTypeDefs = gql`
  enum TierName {
    FREE
    PRO
    ENTERPRISE
  }

  enum BillingEventType {
    API_OVERAGE
    STORAGE_OVERAGE
    NEW_SKU_TIER
  }

  type BillingEvent {
    eventId: String!
    tenantId: String!
    eventType: BillingEventType!
    quantity: Int!
    occurredAt: String!
  }

  type ApiUsageRecord {
    tenantId: String!
    billingCycleId: String!
    apiRequestsCount: Int!
    storageBytesUsed: Int!
    activeSkusCount: Int!
  }

  extend type Query {
    checkRateLimit(tenantId: String!): Boolean!
  }
`;
