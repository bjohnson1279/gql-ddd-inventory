export interface CrossDockOpportunity {
  purchaseOrderId: string;
  variantId: string;
  inboundQuantity: number;
  matchingBackorders: Array<{
    orderId: string;
    requiredQuantity: number;
    priority: number;
  }>;
  recommendedCrossDockQuantity: number;
  destinationBay: string;
}

export class CrossDockingEngine {
  public static evaluate(
    purchaseOrderId: string,
    inboundItems: Array<{ variantId: string; quantity: number }>,
    backorders: Array<{ orderId: string; variantId: string; quantity: number; priority?: number }>
  ): CrossDockOpportunity[] {
    const opportunities: CrossDockOpportunity[] = [];

    // Pre-compute map of variantId to backorders for O(1) lookups
    const backordersByVariant = new Map<string, typeof backorders>();
    for (const b of backorders) {
      let list = backordersByVariant.get(b.variantId);
      if (!list) {
        list = [];
        backordersByVariant.set(b.variantId, list);
      }
      list.push(b);
    }

    for (const item of inboundItems) {
      const matching = backordersByVariant.get(item.variantId);

      if (matching && matching.length > 0) {
        matching.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        let remainingInbound = item.quantity;
        const assignedBackorders = [];

        for (const bo of matching) {
          if (remainingInbound <= 0) break;
          const assigned = Math.min(remainingInbound, bo.quantity);
          assignedBackorders.push({
            orderId: bo.orderId,
            requiredQuantity: assigned,
            priority: bo.priority ?? 1,
          });
          remainingInbound -= assigned;
        }

        const totalAssigned = item.quantity - remainingInbound;
        opportunities.push({
          purchaseOrderId,
          variantId: item.variantId,
          inboundQuantity: item.quantity,
          matchingBackorders: assignedBackorders,
          recommendedCrossDockQuantity: totalAssigned,
          destinationBay: 'DOCK-OUTBOUND-BAY-01',
        });
      }
    }

    return opportunities;
  }
}
