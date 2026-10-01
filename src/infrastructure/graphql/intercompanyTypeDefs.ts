import { gql } from 'apollo-server-express';

export const intercompanyTypeDefs = gql`
  enum TransferStatus {
    DRAFT
    SHIPPED
    RECEIVED
    COMPLETED
  }

  enum PricingRuleType {
    COST_PLUS
    MARKET_BASED
  }

  type IntercompanyJournalEntry {
    transferId: String!
    entityId: String!
    debitAccount: String!
    creditAccount: String!
    amountCents: Int!
    isElimination: Boolean!
  }

  extend type Query {
    intercompanyConsolidatedRevenue(tenantId: String!): Int!
  }
`;
