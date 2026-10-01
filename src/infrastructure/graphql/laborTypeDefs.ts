import { gql } from 'apollo-server-express';

export const laborTypeDefs = gql`
  enum ScheduleStatus {
    DRAFT
    PUBLISHED
  }

  type OperatorPerformanceKpi {
    operatorId: String!
    targetDate: String!
    actualPicksPerHour: Float!
    cycleCountAccuracyPercent: Float!
    traversalDistanceMeters: Float!
  }

  type PredictiveStaffingSchedule {
    scheduleId: String!
    targetDate: String!
    projectedInboundVolume: Int!
    projectedOutboundVolume: Int!
    recommendedHeadcount: Int!
    status: ScheduleStatus!
  }

  extend type Query {
    predictStaffing(targetDate: String!, inboundVol: Int!, outboundVol: Int!, avgPicks: Float!): PredictiveStaffingSchedule!
  }
`;
