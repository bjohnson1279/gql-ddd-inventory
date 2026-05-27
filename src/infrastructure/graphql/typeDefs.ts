export const typeDefs = `#graphql
  type InventoryItem {
    id: ID!
    sku: String!
    locationId: String!
    quantity: Int!
  }

  type Query {
    inventoryItems: [InventoryItem!]!
    inventoryItemBySku(sku: String!): [InventoryItem!]!
    inventoryItemBySkuAndLocation(sku: String!, locationId: String!): InventoryItem
  }

  type InventoryCountResult {
    sku: String!
    locationId: String!
    expected: Int!
    actual: Int!
    variance: Int!
  }

  input InventoryCountInput {
    sku: String!
    locationId: String!
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
    receiveStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    dispatchStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    submitInventoryCount(counts: [InventoryCountInput!]!): [InventoryCountResult!]!
    submitOpeningBalance(input: SubmitOpeningBalanceInput!): Boolean!
  }
`;
