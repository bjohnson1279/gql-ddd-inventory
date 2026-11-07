import { parse } from 'graphql';

export const visionTypeDefs = parse(`
  enum InspectionStatus {
    PENDING
    ANALYZED
    FLAGGED
    PASSED
  }

  enum DimensionUnit {
    CM
    INCH
  }

  type VolumeDimensions {
    length: Float!
    width: Float!
    height: Float!
    unit: DimensionUnit!
  }

  type InspectionResult {
    inspectionId: String!
    detectedBarcode: String!
    dimensions: VolumeDimensions!
    damageScore: Float!
    anomaliesDetected: [String!]!
  }

  type VisionInspection {
    inspectionId: String!
    tenantId: String!
    dockStationId: String!
    capturedAt: String!
    imageUrl: String!
    status: InspectionStatus!
  }

  extend type Mutation {
    processDockImage(imageUrl: String!, dockStationId: String!): VisionInspection!
  }
`);
