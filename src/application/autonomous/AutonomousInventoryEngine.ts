export interface StockItemMetric {
  sku: string;
  name: string;
  currentStock: number;
  safetyStock: number;
  avgDailySales: number;
  supplierLeadTimeDays: number;
  unitCost: number;
  supplierId: string;
}

export interface ReorderRecommendation {
  sku: string;
  name: string;
  currentStock: number;
  predictedDaysUntilStockout: number;
  recommendedOrderQuantity: number;
  totalEstimatedCost: number;
  urgency: 'CRITICAL' | 'WARNING' | 'OPTIONAL';
  status: 'DRAFT_PO_CREATED' | 'AUTO_ISSUED' | 'MONITORING';
}

export class AutonomousInventoryEngine {
  private mode: 'FULLY_AUTONOMOUS' | 'HUMAN_IN_THE_LOOP' = 'HUMAN_IN_THE_LOOP';

  constructor(mode: 'FULLY_AUTONOMOUS' | 'HUMAN_IN_THE_LOOP' = 'HUMAN_IN_THE_LOOP') {
    this.mode = mode;
  }

  public setMode(mode: 'FULLY_AUTONOMOUS' | 'HUMAN_IN_THE_LOOP') {
    this.mode = mode;
  }

  public evaluateStockHealth(items: StockItemMetric[]): ReorderRecommendation[] {
    const recommendations: ReorderRecommendation[] = [];

    for (const item of items) {
      const salesVelocity = Math.max(0.1, item.avgDailySales);
      const daysUntilStockout = item.currentStock / salesVelocity;
      const reorderThreshold = item.safetyStock + (salesVelocity * item.supplierLeadTimeDays);

      if (item.currentStock <= reorderThreshold) {
        // Calculate EOQ / Recommended Order Batch (target 30 days buffer)
        const recommendedQty = Math.ceil((salesVelocity * 30) + item.safetyStock - item.currentStock);
        const totalCost = recommendedQty * item.unitCost;

        let urgency: 'CRITICAL' | 'WARNING' | 'OPTIONAL' = 'OPTIONAL';
        if (daysUntilStockout <= item.supplierLeadTimeDays) {
          urgency = 'CRITICAL';
        } else if (daysUntilStockout <= item.supplierLeadTimeDays * 1.5) {
          urgency = 'WARNING';
        }

        const status = this.mode === 'FULLY_AUTONOMOUS' ? 'AUTO_ISSUED' : 'DRAFT_PO_CREATED';

        recommendations.push({
          sku: item.sku,
          name: item.name,
          currentStock: item.currentStock,
          predictedDaysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
          recommendedOrderQuantity: recommendedQty,
          totalEstimatedCost: Math.round(totalCost * 100) / 100,
          urgency,
          status,
        });
      }
    }

    return recommendations.sort((a, b) => a.predictedDaysUntilStockout - b.predictedDaysUntilStockout);
  }
}
