import { LotBatch, LotStatus } from '../entities/LotBatch';

export interface LotTraceabilityReport {
  lotNumber: string;
  variantId: string;
  status: LotStatus;
  quarantineReason?: string;
  affectedCostLayersCount: number;
  affectedOrders: Array<{ orderId: string; quantity: number }>;
  affectedCustomers: string[];
}

export class LotRecallWorkflowService {
  public static generateTraceabilityReport(
    lot: LotBatch,
    costLayers: Array<{ id: string; consumedQuantity: number; initialQuantity: number }>,
    fulfilledShipments: Array<{ id: string; orderId: string; customerId: string; quantity: number }>
  ): LotTraceabilityReport {
    const affectedOrders = fulfilledShipments.map(s => ({
      orderId: s.orderId,
      quantity: s.quantity,
    }));

    const customerSet = new Set(fulfilledShipments.map(s => s.customerId).filter(Boolean));

    return {
      lotNumber: lot.lotNumber,
      variantId: lot.variantId,
      status: lot.status,
      quarantineReason: lot.quarantineReason,
      affectedCostLayersCount: costLayers.length,
      affectedOrders,
      affectedCustomers: Array.from(customerSet),
    };
  }
}
