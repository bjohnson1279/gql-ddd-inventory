import { InventoryAgingService, DeadStockRecommendationEngine, EsgEmissionsCalculator } from '../../domain/aging/AgingServices';

const agingService = new InventoryAgingService();
const recommendationEngine = new DeadStockRecommendationEngine();
const esgCalc = new EsgEmissionsCalculator();

export const agingResolvers = {
  Query: {
    analyzeAging: (_: any, args: { sku: string, locationId: string, tenantId: string }) => {
      // Mock data that would normally be fetched from a repository
      const now = new Date();
      const mockEntries = [
        { quantity: 50, occurredAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000) }
      ];

      const agingData = agingService.calculateAgingBuckets(args.sku, args.locationId, args.tenantId, now, mockEntries);
      
      const analysis = recommendationEngine.analyze(
        args.sku,
        args.locationId,
        args.tenantId,
        50,
        1000,
        agingData.daysSinceLastMovement,
        agingData.bucket,
        true
      );
      
      const emissions = esgCalc.calculateScrapEmissions(args.sku, 50, 1.2);

      return {
        ...analysis,
        potentialScrapEmissionsKg: emissions
      };
    }
  }
};
