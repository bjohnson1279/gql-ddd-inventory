import { parse } from 'graphql';

export const cycleCountTypeDefs = parse(`
  type CycleCountLineItem {
    id: ID!
    cycleCountId: ID!
    sku: String!
    expectedQuantity: Int
    countedQuantity: Int
    varianceQuantity: Int
    varianceValue: Float
    status: String!
  }

  type CycleCount {
    id: ID!
    tenantId: ID!
    name: String!
    status: String!
    abcClass: String
    zone: String
    isBlindCount: Boolean!
    assignedTo: String
    items: [CycleCountLineItem!]!
    createdAt: String!
  }

  input SubmitCountItemInput {
    sku: String!
    countedQuantity: Int!
  }

  extend type Query {
    getAssignedCycleCounts(operatorId: String!): [CycleCount!]!
  }

  extend type Mutation {
    submitCycleCount(cycleCountId: ID!, items: [SubmitCountItemInput!]!): CycleCount!
    syncOfflineCycleCounts(submissions: [SubmitOfflineCountInput!]!): [SyncResult!]!
  }

  input SubmitOfflineCountInput {
    cycleCountId: ID!
    items: [SubmitCountItemInput!]!
  }

  type SyncResult {
    cycleCountId: ID!
    success: Boolean!
    status: String!
  }
`);
