import { VisionInspection, InspectionStatus } from '../../../src/domain/vision/VisionEntities';
import { ComputerVisionService, QaGatewayService } from '../../../src/domain/vision/VisionServices';

describe('Vision Services', () => {
  it('QaGatewayService passes good image', () => {
    const cvService = new ComputerVisionService();
    const qaService = new QaGatewayService();

    const inspection = new VisionInspection(
      "INS1", "T1", "DOCK1", new Date(), "http://storage.com/image.jpg"
    );

    const result = cvService.analyzeImage(inspection.imageUrl, inspection.inspectionId);
    qaService.processInspection(inspection, result);

    expect(inspection.status).toBe(InspectionStatus.PASSED);
    expect(result.damageScore).toBe(0.05);
  });

  it('QaGatewayService flags damaged image', () => {
    const cvService = new ComputerVisionService();
    const qaService = new QaGatewayService();

    const inspection = new VisionInspection(
      "INS2", "T1", "DOCK1", new Date(), "http://storage.com/damaged_box.jpg"
    );

    const result = cvService.analyzeImage(inspection.imageUrl, inspection.inspectionId);
    qaService.processInspection(inspection, result, 0.5);

    expect(inspection.status).toBe(InspectionStatus.FLAGGED);
    expect(result.damageScore).toBe(0.85);
    expect(result.anomaliesDetected).toContain("CRUSHED_CORNER");
  });
});
