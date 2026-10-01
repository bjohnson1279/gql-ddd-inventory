import { parse } from 'graphql';

export const supplierPortalTypeDefs = parse(`
  type Supplier {
    id: ID!
    tenantId: ID!
    name: String!
    contactEmail: String!
    status: String!
  }

  type PurchaseOrder {
    id: ID!
    tenantId: ID!
    supplierId: ID!
    status: String!
    expectedDeliveryDate: String
    acknowledgedDate: String
    issuedAt: String!
  }

  type ASNLineItem {
    id: ID!
    asnId: ID!
    sku: String!
    shippedQuantity: Int!
    lotNumber: String
  }

  type AdvanceShippingNotice {
    id: ID!
    poId: ID!
    supplierId: ID!
    trackingNumber: String!
    estimatedDeliveryDate: String!
    status: String!
    items: [ASNLineItem!]!
    createdAt: String!
  }

  type SupplierPerformance {
    supplierId: ID!
    otifPercentage: Float!
    averageLeadTimeVarianceDays: Float!
    defectRatePercentage: Float!
    totalOrdersEvaluated: Int!
  }

  input ASNLineItemInput {
    sku: String!
    shippedQuantity: Int!
    lotNumber: String
  }

  input SubmitASNInput {
    poId: ID!
    trackingNumber: String!
    estimatedDeliveryDate: String!
    items: [ASNLineItemInput!]!
  }

  extend type Query {
    getSupplierPOs: [PurchaseOrder!]!
    getSupplierPerformance: SupplierPerformance!
  }

  extend type Mutation {
    acknowledgePO(poId: ID!, expectedDeliveryDate: String!): PurchaseOrder!
    submitASN(input: SubmitASNInput!): AdvanceShippingNotice!
  }
`);
