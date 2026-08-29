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

  type DashboardWidget {
    id: ID!
    tenantId: String!
    type: String!
    config: String!
    layoutX: Int!
    layoutY: Int!
    width: Int!
    height: Int!
  }

  extend type Query {
    reports: [ReportDefinition!]!
    sharedReportLink(token: String!): SharedReportLink
    dashboardWidgets: [DashboardWidget!]!
  }

  extend type Mutation {
    createReport(name: String!, description: String, type: String!, filters: String, grouping: String): ReportDefinition!
    scheduleReport(id: ID!, cronExpression: String!, deliveryMethod: String): ReportSchedule!
    executeReport(id: ID!, format: String): ReportExecution!
    saveDashboardWidget(type: String!, config: String!, layoutX: Int!, layoutY: Int!, width: Int!, height: Int!): DashboardWidget!
    updateDashboardWidget(id: ID!, type: String, config: String, layoutX: Int, layoutY: Int, width: Int, height: Int): DashboardWidget!
    deleteDashboardWidget(id: ID!): Boolean!
  }
`);