import { LotBatch } from '../../src/domain/entities/LotBatch';
import { LotRecallWorkflowService } from '../../src/domain/services/LotRecallWorkflowService';
import { CrossDockingEngine } from '../../src/domain/services/CrossDockingEngine';

describe('Lot Recall & FEFO Quarantine Workflow (GraphQL backend)', () => {
  it('should manage lot status transitions correctly', () => {
    const lot = new LotBatch('lot-1', 'tenant-1', 'LOT-99', 'VAR-123', 'ACTIVE');
    expect(lot.isAvailable()).toBe(true);

    lot.quarantine('Contamination suspicion');
    expect(lot.status).toBe('QUARANTINED');
    expect(lot.isAvailable()).toBe(false);

    lot.release();
    expect(lot.status).toBe('ACTIVE');
    expect(lot.isAvailable()).toBe(true);

    lot.recall('FDA recall notice');
    expect(lot.status).toBe('RECALLED');
    expect(lot.isAvailable()).toBe(false);
  });

  it('should generate accurate traceability reports for recalled lots', () => {
    const lot = new LotBatch('lot-1', 'tenant-1', 'LOT-99', 'VAR-123', 'RECALLED', undefined, undefined, 'SUPP-1', new Date(), 'Defect');
    const costLayers = [
      { id: 'layer-1', consumedQuantity: 10, initialQuantity: 20 },
      { id: 'layer-2', consumedQuantity: 5, initialQuantity: 5 }
    ];
    const shipments = [
      { id: 'ship-1', orderId: 'ORD-100', customerId: 'CUST-A', quantity: 10 },
      { id: 'ship-2', orderId: 'ORD-101', customerId: 'CUST-B', quantity: 5 }
    ];

    const report = LotRecallWorkflowService.generateTraceabilityReport(lot, costLayers, shipments);
    expect(report.lotNumber).toBe('LOT-99');
    expect(report.affectedCostLayersCount).toBe(2);
    expect(report.affectedOrders.length).toBe(2);
    expect(report.affectedCustomers).toContain('CUST-A');
    expect(report.affectedCustomers).toContain('CUST-B');
  });

  it('should evaluate cross-docking opportunities accurately', () => {
    const inboundItems = [{ variantId: 'VAR-100', quantity: 50 }];
    const backorders = [
      { orderId: 'BO-1', variantId: 'VAR-100', quantity: 30, priority: 2 },
      { orderId: 'BO-2', variantId: 'VAR-100', quantity: 40, priority: 1 }
    ];

    const opportunities = CrossDockingEngine.evaluate('PO-999', inboundItems, backorders);
    expect(opportunities.length).toBe(1);
    expect(opportunities[0].recommendedCrossDockQuantity).toBe(50);
    expect(opportunities[0].matchingBackorders.length).toBe(2);
    expect(opportunities[0].matchingBackorders[0].orderId).toBe('BO-1');
  });
});
