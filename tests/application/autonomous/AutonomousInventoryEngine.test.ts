import { AutonomousInventoryEngine, StockItemMetric } from '../../../src/application/autonomous/AutonomousInventoryEngine';

describe('AutonomousInventoryEngine', () => {
  let engine: AutonomousInventoryEngine;

  beforeEach(() => {
    engine = new AutonomousInventoryEngine();
  });

  describe('constructor and setMode', () => {
    it('should initialize with HUMAN_IN_THE_LOOP mode by default', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);
      expect(results[0].status).toBe('DRAFT_PO_CREATED');
    });

    it('should allow initializing with FULLY_AUTONOMOUS mode', () => {
      const autoEngine = new AutonomousInventoryEngine('FULLY_AUTONOMOUS');
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = autoEngine.evaluateStockHealth(items);
      expect(results[0].status).toBe('AUTO_ISSUED');
    });

    it('should update mode using setMode', () => {
      engine.setMode('FULLY_AUTONOMOUS');
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);
      expect(results[0].status).toBe('AUTO_ISSUED');
    });
  });

  describe('evaluateStockHealth', () => {
    it('should return empty array when given no items', () => {
      expect(engine.evaluateStockHealth([])).toEqual([]);
    });

    it('should not recommend reorder if current stock is above threshold', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 100, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      expect(engine.evaluateStockHealth(items)).toEqual([]);
    });

    it('should calculate recommendations correctly when stock is at or below threshold', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 25, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);
      expect(results).toHaveLength(1);

      expect(results[0]).toEqual({
        sku: 'TEST-1',
        name: 'Test Item',
        currentStock: 25,
        predictedDaysUntilStockout: 5,
        recommendedOrderQuantity: 145,
        totalEstimatedCost: 1450,
        urgency: 'OPTIONAL',
        status: 'DRAFT_PO_CREATED',
      });
    });

    it('should assign CRITICAL urgency when days until stockout is less than or equal to lead time', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);
      expect(results[0].urgency).toBe('CRITICAL');
    });

    it('should assign WARNING urgency when days until stockout is <= 1.5x lead time but > lead time', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 15, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);
      expect(results[0].urgency).toBe('WARNING');
    });

    it('should handle zero avgDailySales by falling back to 0.1 sales velocity', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 5, safetyStock: 10, avgDailySales: 0, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);

      expect(results[0].predictedDaysUntilStockout).toBe(50);
      expect(results[0].recommendedOrderQuantity).toBe(8);
      expect(results[0].totalEstimatedCost).toBe(80);
    });

    it('should sort recommendations by predictedDaysUntilStockout ascending', () => {
      const items: StockItemMetric[] = [
        { sku: 'ITEM-A', name: 'A', currentStock: 50, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' },
        { sku: 'ITEM-B', name: 'B', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' },
        { sku: 'ITEM-C', name: 'C', currentStock: 20, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' },
        { sku: 'ITEM-D', name: 'D', currentStock: 5, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' },
      ];
      const results = engine.evaluateStockHealth(items);
      expect(results).toHaveLength(3);
      expect(results[0].sku).toBe('ITEM-D');
      expect(results[1].sku).toBe('ITEM-B');
      expect(results[2].sku).toBe('ITEM-C');
    });
  });
});
