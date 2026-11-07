import { ComputerVisionService, QaGatewayService } from '../../domain/vision/VisionServices';
import { VisionInspection, InspectionStatus } from '../../domain/vision/VisionEntities';
import { validateOutboundUrl } from '../../utils/urlValidator';
import { randomUUID as uuidv4 } from 'crypto';

const cvService = new ComputerVisionService();
const qaService = new QaGatewayService();

export const visionResolvers = {
  Mutation: {
    processDockImage: (_: any, args: { imageUrl: string, dockStationId: string }, context: any) => {
      const tenantId = context?.auth?.tenantId || context?.tenantId;
      if (!tenantId) {
        throw new Error("Authentication required: Access token is missing or invalid.");
      }

      // 🛡️ Sentinel: Validate imageUrl against SSRF attacks before processing
      validateOutboundUrl(args.imageUrl);

      const inspection = new VisionInspection(
        uuidv4(),
        tenantId,
        args.dockStationId,
        new Date(),
        args.imageUrl,
        InspectionStatus.PENDING
      );
      
      const result = cvService.analyzeImage(inspection.imageUrl, inspection.inspectionId);
      qaService.processInspection(inspection, result, 0.70);
      
      return inspection;
    }
  }
};
