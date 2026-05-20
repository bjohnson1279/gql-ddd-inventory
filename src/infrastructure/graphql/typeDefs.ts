export const typeDefs = `#graphql
  type InventoryItem {
    id: ID!
    sku: String!
    quantity: Int!
  }

  type Query {
    inventoryItems: [InventoryItem!]!
    inventoryItemBySku(sku: String!): InventoryItem
  }

  type InventoryCountResult {
    sku: String!
    expected: Int!
    actual: Int!
    variance: Int!
  }

  input InventoryCountInput {
    sku: String!
    actualQuantity: Int!
  }

  input OpeningBalanceItemInput {
    variantId: ID!
    quantity: Int!
    unitCostCents: Int!
  }

  input SubmitOpeningBalanceInput {
    tenantId: ID!
    locationId: ID!
    asOfDate: String!
    actorId: ID!
    items: [OpeningBalanceItemInput!]!
  }

  type Mutation {
    receiveStock(sku: String!, amount: Int!): InventoryItem!
    dispatchStock(sku: String!, amount: Int!): InventoryItem!
    submitInventoryCount(counts: [InventoryCountInput!]!): [InventoryCountResult!]!
    submitOpeningBalance(input: SubmitOpeningBalanceInput!): Boolean!
  }
`;
