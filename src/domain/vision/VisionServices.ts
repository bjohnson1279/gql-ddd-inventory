import { 
  VisionInspection, InspectionResult, VolumeDimensions, DimensionUnit 
} from './VisionEntities';

export class ComputerVisionService {
  public analyzeImage(imageUrl: string, inspectionId: string): InspectionResult {
    const isDamaged = imageUrl.toLowerCase().includes('damaged');
    const damageScore = isDamaged ? 0.85 : 0.05;
    const anomalies = isDamaged ? ["CRUSHED_CORNER"] : [];

    return {
      inspectionId,
      detectedBarcode: "123456789012",
      dimensions: { length: 10.0, width: 10.0, height: 10.0, unit: DimensionUnit.CM },
      damageScore,
      anomaliesDetected: anomalies
    };
  }
}

export class QaGatewayService {
  public processInspection(inspection: VisionInspection, result: InspectionResult, damageThreshold: number = 0.70): void {
    if (result.damageScore >= damageThreshold) {
      inspection.flagInspection();
    } else {
      inspection.passInspection();
    }
  }
}
