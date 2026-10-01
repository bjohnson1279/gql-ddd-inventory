import { gql } from 'apollo-server-express';

export const notificationTypeDefs = gql`
  enum NotificationCategory {
    INVENTORY_LEVEL
    SYSTEM_ANOMALY
    WEBHOOK_FAILURE
    APPROVAL_REQUIRED
  }

  enum NotificationSeverity {
    INFO
    WARNING
    CRITICAL
  }

  enum NotificationStatus {
    UNREAD
    READ
    SNOOZED
    ESCALATED
  }

  type Notification {
    id: ID!
    tenantId: String!
    userId: String!
    category: NotificationCategory!
    severity: NotificationSeverity!
    message: String!
    status: NotificationStatus!
    createdAt: String!
    snoozedUntil: String
  }

  extend type Query {
    unreadNotificationCount(userId: ID!): Int!
  }

  extend type Mutation {
    markNotificationRead(notificationId: ID!, userId: ID!): Boolean!
    snoozeNotification(notificationId: ID!, userId: ID!, hours: Int!): Boolean!
    escalateNotification(notificationId: ID!, userId: ID!, targetManagerId: ID!): Notification
  }
`;
