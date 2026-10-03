export interface CycleCountLineItem {
  id: string;
  cycleCountId: string;
  sku: string;
  expectedQuantity: number;
  countedQuantity?: number;
  varianceQuantity?: number;
  varianceValue?: number;
  status: 'PENDING' | 'MATCHED' | 'VARIANCE_FLAGGED' | 'RECOUNT_REQUIRED';
}

export class CycleCountExecutionService {
  public processSubmission(
    items: CycleCountLineItem[],
    submittedCounts: { sku: string; countedQuantity: number }[],
    varianceThresholdPct: number = 0.05
  ): boolean {
    let requiresRecount = false;
    
    // ⚡ Bolt: Single pass loop avoids intermediate array allocation from .map()
    const submittedMap = new Map<string, number>();
    for (const s of submittedCounts) {
      submittedMap.set(s.sku, s.countedQuantity);
    }

    for (const item of items) {
      const counted = submittedMap.get(item.sku);
      if (counted !== undefined) {
        item.countedQuantity = counted;
        item.varianceQuantity = counted - item.expectedQuantity;
        
        // Simple variance check
        const variancePct = item.expectedQuantity === 0 
          ? (counted === 0 ? 0 : 1) 
          : Math.abs(item.varianceQuantity) / item.expectedQuantity;
          
        if (variancePct > varianceThresholdPct) {
          item.status = 'VARIANCE_FLAGGED';
          requiresRecount = true;
        } else {
          item.status = 'MATCHED';
        }
      }
    }

    return !requiresRecount;
  }
}
