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

  type Mutation {
    receiveStock(sku: String!, amount: Int!): InventoryItem!
    dispatchStock(sku: String!, amount: Int!): InventoryItem!
    submitInventoryCount(counts: [InventoryCountInput!]!): [InventoryCountResult!]!
  }
`;
