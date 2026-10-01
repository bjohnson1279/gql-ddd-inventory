import { gql } from 'apollo-server-express';

export const agingTypeDefs = gql`
  enum AgingBucket {
    DAYS_0_30
    DAYS_31_60
    DAYS_61_90
    DAYS_91_180
    OVER_180_DAYS
  }

  enum RecommendedAction {
    NONE
    MARKDOWN
    LIQUIDATE
    DONATE
    SCRAP
  }

  type DeadStockAnalysis {
    sku: String!
    locationId: String!
    tenantId: String!
    currentQuantity: Int!
    daysSinceLastMovement: Int!
    isDeadStock: Boolean!
    agingBucket: AgingBucket!
    lockedCapitalCents: Int!
    recommendedAction: RecommendedAction!
    potentialScrapEmissionsKg: Float
  }

  extend type Query {
    analyzeAging(sku: String!, locationId: String!, tenantId: String!): DeadStockAnalysis!
  }
`;
