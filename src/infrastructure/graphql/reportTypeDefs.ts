import { parse } from 'graphql';
export const reportTypeDefs = parse(`
  type ReportDefinition {
    id: ID!
    tenantId: String!
    name: String!
    description: String
    type: String!
    filters: String!
    grouping: String!
    createdBy: String!
    createdAt: String!
    updatedAt: String!
  }

  type ReportSchedule {
    id: ID!
    reportDefinitionId: String!
    cronExpression: String!
    deliveryMethod: String!
    nextRunAt: String!
    createdAt: String!
    updatedAt: String!
  }

  type ReportExecution {
    id: ID!
    reportDefinitionId: String!
    status: String!
    format: String!
    fileUrl: String
    createdAt: String!
    updatedAt: String!
  }

  type SharedReportLink {
    fileUrl: String
  }

  extend type Query {
    reports: [ReportDefinition!]!
    sharedReportLink(token: String!): SharedReportLink
  }

  extend type Mutation {
    createReport(name: String!, description: String, type: String!, filters: String, grouping: String): ReportDefinition!
    scheduleReport(id: ID!, cronExpression: String!, deliveryMethod: String): ReportSchedule!
    executeReport(id: ID!, format: String): ReportExecution!
  }
`);