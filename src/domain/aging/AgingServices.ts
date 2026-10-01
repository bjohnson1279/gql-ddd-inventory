import { AgingBucket, RecommendedAction, DeadStockAnalysis } from './AgingEntities';

export class InventoryAgingService {
  public calculateAgingBuckets(
    sku: string,
    locationId: string,
    tenantId: string,
    currentDate: Date,
    ledgerEntries: any[]
  ): { daysSinceLastMovement: number; bucket: AgingBucket } {
    let lastReceiptDate: Date | null = null;
    
    for (const entry of ledgerEntries) {
      if ((entry.quantity || 0) > 0) {
        const entryDate = new Date(entry.occurredAt || entry.occurred_at);
        if (!lastReceiptDate || entryDate > lastReceiptDate) {
          lastReceiptDate = entryDate;
        }
      }
    }
    
    let daysOld = 0;
    if (lastReceiptDate) {
      const diffTime = currentDate.getTime() - lastReceiptDate.getTime();
      daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    
    let bucket = AgingBucket.DAYS_0_30;
    if (daysOld > 180) bucket = AgingBucket.OVER_180_DAYS;
    else if (daysOld > 90) bucket = AgingBucket.DAYS_91_180;
    else if (daysOld > 60) bucket = AgingBucket.DAYS_61_90;
    else if (daysOld > 30) bucket = AgingBucket.DAYS_31_60;
    
    return {
      daysSinceLastMovement: Math.max(daysOld, 0),
      bucket
    };
  }
}

export class DeadStockRecommendationEngine {
  public analyze(
    sku: string,
    locationId: string,
    tenantId: string,
    currentQuantity: number,
    unitCostCents: number,
    daysSinceLastMovement: number,
    agingBucket: AgingBucket,
    hasOverstock: boolean
  ): DeadStockAnalysis {
    const isDeadStock = daysSinceLastMovement > 180;
    let action = RecommendedAction.NONE;
    
    if (isDeadStock) {
      action = currentQuantity > 10 ? RecommendedAction.LIQUIDATE : RecommendedAction.DONATE;
    } else if (agingBucket === AgingBucket.DAYS_91_180 && hasOverstock) {
      action = RecommendedAction.MARKDOWN;
    }
    
    const lockedCapital = currentQuantity * unitCostCents;
    
    return {
      sku,
      locationId,
      tenantId,
      currentQuantity,
      daysSinceLastMovement,
      isDeadStock,
      agingBucket,
      lockedCapitalCents: lockedCapital,
      recommendedAction: action
    };
  }
}

export class EsgEmissionsCalculator {
  public calculateScrapEmissions(sku: string, quantity: number, factorPerUnitKg: number): number {
    return quantity * factorPerUnitKg;
  }
}
