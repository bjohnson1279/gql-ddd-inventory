import * as crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();
import { 
  LiquidationProfile, InventoryYieldMetrics, PriceMarkdownRecommendation, MarkdownStatus 
} from './YieldEntities';

export class YieldCalculationService {
  public calculateOptimalPrice(metrics: InventoryYieldMetrics, profile: LiquidationProfile): number {
    let currentPrice = profile.basePriceCents;
    
    const accruedHoldingCost = metrics.daysInInventory * profile.holdingCostPerDayCents;
    currentPrice -= accruedHoldingCost;
    
    if (metrics.daysUntilExpiration !== null && metrics.daysUntilExpiration < 14) {
      const expectedSales = metrics.historicalDailyDemand * metrics.daysUntilExpiration;
      if (metrics.currentStockQuantity > expectedSales) {
        currentPrice = profile.minFloorPriceCents;
      }
    }
    
    return Math.max(currentPrice, profile.minFloorPriceCents);
  }
}

export class DynamicPricingEngine {
  constructor(private calculationService: YieldCalculationService) {}

  public generateMarkdown(
    metrics: InventoryYieldMetrics, 
    profile: LiquidationProfile
  ): PriceMarkdownRecommendation | null {
    
    const optimalPrice = this.calculationService.calculateOptimalPrice(metrics, profile);
    
    if (optimalPrice < profile.basePriceCents) {
      let reasoning = "Accrued holding costs";
      if (
        optimalPrice === profile.minFloorPriceCents && 
        metrics.daysUntilExpiration !== null && 
        metrics.daysUntilExpiration < 14
      ) {
        reasoning = "Approaching Expiration - High Overstock";
      }
      
      return new PriceMarkdownRecommendation(
        uuidv4(),
        metrics.sku,
        optimalPrice,
        reasoning
      );
    }
    
    return null;
  }
}
