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

      // salesVelocity = 5
      // reorderThreshold = 20 + (5 * 2) = 30
      // daysUntilStockout = 25 / 5 = 5
      // recommendedQty = ceil((5 * 30) + 20 - 25) = ceil(150 + 20 - 25) = 145
      // totalCost = 145 * 10 = 1450

      expect(results[0]).toEqual({
        sku: 'TEST-1',
        name: 'Test Item',
        currentStock: 25,
        predictedDaysUntilStockout: 5,
        recommendedOrderQuantity: 145,
        totalEstimatedCost: 1450,
        urgency: 'OPTIONAL', // daysUntilStockout(5) > 1.5 * leadTime(3)
        status: 'DRAFT_PO_CREATED',
      });
    });

    it('should assign CRITICAL urgency when days until stockout is less than or equal to lead time', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      // daysUntilStockout = 10 / 5 = 2. 2 <= 2 (lead time) -> CRITICAL
      const results = engine.evaluateStockHealth(items);
      expect(results[0].urgency).toBe('CRITICAL');
    });

    it('should assign WARNING urgency when days until stockout is <= 1.5x lead time but > lead time', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 15, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      // daysUntilStockout = 15 / 5 = 3. 3 <= 1.5 * 2 (3) -> WARNING
      const results = engine.evaluateStockHealth(items);
      expect(results[0].urgency).toBe('WARNING');
    });

    it('should handle zero avgDailySales by falling back to 0.1 sales velocity', () => {
      const items: StockItemMetric[] = [{
        sku: 'TEST-1', name: 'Test Item', currentStock: 5, safetyStock: 10, avgDailySales: 0, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'SUP-1'
      }];
      const results = engine.evaluateStockHealth(items);

      // salesVelocity = 0.1
      // daysUntilStockout = 5 / 0.1 = 50
      // recommendedQty = ceil((0.1 * 30) + 10 - 5) = ceil(3 + 10 - 5) = 8
      // totalCost = 8 * 10 = 80
      expect(results[0].predictedDaysUntilStockout).toBe(50);
      expect(results[0].recommendedOrderQuantity).toBe(8);
      expect(results[0].totalEstimatedCost).toBe(80);
    });

    it('should sort recommendations by predictedDaysUntilStockout ascending', () => {
      const items: StockItemMetric[] = [
        { sku: 'ITEM-A', name: 'A', currentStock: 50, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' }, // not recommended (50 > 30)
        { sku: 'ITEM-B', name: 'B', currentStock: 10, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' }, // days: 2
        { sku: 'ITEM-C', name: 'C', currentStock: 20, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' }, // days: 4
        { sku: 'ITEM-D', name: 'D', currentStock: 5, safetyStock: 20, avgDailySales: 5, supplierLeadTimeDays: 2, unitCost: 10, supplierId: 'S1' }, // days: 1
      ];
      const results = engine.evaluateStockHealth(items);
      expect(results).toHaveLength(3);
      expect(results[0].sku).toBe('ITEM-D'); // days: 1
      expect(results[1].sku).toBe('ITEM-B'); // days: 2
      expect(results[2].sku).toBe('ITEM-C'); // days: 4
    });
  });
});
