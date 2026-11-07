import { parse } from 'graphql';

export const yieldTypeDefs = parse(`
  enum MarkdownStatus {
    PROPOSED
    APPROVED
    PUSHED_TO_CHANNELS
  }

  type PriceMarkdownRecommendation {
    id: String!
    sku: String!
    recommendedPriceCents: Int!
    reasoning: String!
    status: MarkdownStatus!
  }

  input InventoryYieldMetricsInput {
    sku: String!
    daysInInventory: Int!
    daysUntilExpiration: Int
    historicalDailyDemand: Float!
    currentStockQuantity: Int!
  }

  input LiquidationProfileInput {
    sku: String!
    basePriceCents: Int!
    holdingCostPerDayCents: Int!
    minFloorPriceCents: Int!
  }

  extend type Query {
    recommendMarkdown(metrics: InventoryYieldMetricsInput!, profile: LiquidationProfileInput!): PriceMarkdownRecommendation
  }
`);
