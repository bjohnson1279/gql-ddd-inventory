import { RebalanceOptimizationService } from '../../../src/domain/services/RebalanceOptimizationService';
import { PrismaClient } from '@prisma/client';

describe('RebalanceOptimizationService', () => {
  let prismaMock: any;
  let service: RebalanceOptimizationService;
  let originalFetch: any;

  beforeEach(() => {
    prismaMock = {
      warehouseLocation: {
        findMany: jest.fn()
      },
      inventoryItem: {
        findMany: jest.fn()
      },
      demandForecast: {
        findMany: jest.fn()
      },
      replenishmentRule: {
        findMany: jest.fn()
      }
    };
    service = new RebalanceOptimizationService(prismaMock as PrismaClient);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('Warehouse threshold boundary', () => {
    it('returns empty result when there are 0 warehouse locations', async () => {
      prismaMock.warehouseLocation.findMany.mockResolvedValue([]);

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(result).toEqual({
        recommendations: [],
        matrix: {},
        summary: { totalTransfers: 0, totalCost: 0, skusImproved: 0, avgDocImprovement: 0 }
      });
      expect(prismaMock.inventoryItem.findMany).not.toHaveBeenCalled();
    });

    it('returns empty result when there is only 1 warehouse location', async () => {
      prismaMock.warehouseLocation.findMany.mockResolvedValue([
        { id: 'LOC-1', warehouseId: 'WH-1', zone: 'A' }
      ]);

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(result).toEqual({
        recommendations: [],
        matrix: {},
        summary: { totalTransfers: 0, totalCost: 0, skusImproved: 0, avgDocImprovement: 0 }
      });
    });
  });

  describe('Sidecar Optimization Request and Response Mapping', () => {
    it('sends correct data payload to Python sidecar and maps snake_case response to camelCase domain model', async () => {
      prismaMock.warehouseLocation.findMany.mockResolvedValue([
        { id: 'LOC-1', warehouseId: 'WH-1', zone: 'NORTH' },
        { id: 'LOC-2', warehouseId: 'WH-2', zone: 'SOUTH' }
      ]);

      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { sku: 'SKU-A', locationId: 'LOC-1', quantity: 100, allocated: 10, inTransit: 5 },
        { sku: 'SKU-A', locationId: 'LOC-2', quantity: 10, allocated: 0, inTransit: 0 }
      ]);

      prismaMock.demandForecast.findMany.mockResolvedValue([
        { sku: 'SKU-A', locationId: 'LOC-1', forecastedQuantity: 70 },
        { sku: 'SKU-A', locationId: 'LOC-2', forecastedQuantity: 300 }
      ]);

      prismaMock.replenishmentRule.findMany.mockResolvedValue([
        { sourceLocationId: 'LOC-1', leadTimeDays: 5 }
      ]);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          recommendations: [
            {
              sku: 'SKU-A',
              source_warehouse_id: 'WH-1',
              dest_warehouse_id: 'WH-2',
              quantity: 25,
              priority: 'HIGH',
              estimated_shipping_cost: 37.5,
              source_current_doc: 45.0,
              dest_current_doc: 1.0,
              source_projected_doc: 32.5,
              dest_projected_doc: 15.0,
              urgency_reason: 'Prevent stockout at WH-2'
            }
          ],
          matrix: {
            'WH-1': { 'SKU-A': { onHand: 100, available: 90, doc: 45, status: 'SURPLUS' } },
            'WH-2': { 'SKU-A': { onHand: 10, available: 10, doc: 1, status: 'DEFICIT' } }
          },
          summary: {
            total_transfers: 1,
            total_cost: 37.5,
            skus_improved: 1,
            avg_doc_improvement: 14.0
          }
        })
      });
      global.fetch = mockFetch;

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5005/rebalance-optimize',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.warehouses).toHaveLength(2);
      expect(requestBody.stock_levels).toHaveLength(2);
      expect(requestBody.demand_forecasts).toHaveLength(2);
      expect(requestBody.lead_times).toHaveLength(2);
      expect(requestBody.lead_times.find((lt: any) => lt.source_warehouse_id === 'WH-1').transit_days).toBe(5);

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0]).toEqual({
        sku: 'SKU-A',
        sourceWarehouseId: 'WH-1',
        destWarehouseId: 'WH-2',
        quantity: 25,
        priority: 'HIGH',
        estimatedShippingCost: 37.5,
        sourceCurrentDoc: 45.0,
        destCurrentDoc: 1.0,
        sourceProjectedDoc: 32.5,
        destProjectedDoc: 15.0,
        urgencyReason: 'Prevent stockout at WH-2'
      });

      expect(result.summary).toEqual({
        totalTransfers: 1,
        totalCost: 37.5,
        skusImproved: 1,
        avgDocImprovement: 14.0
      });
    });

    it('handles sidecar response with missing optional payload fields gracefully', async () => {
      prismaMock.warehouseLocation.findMany.mockResolvedValue([
        { id: 'LOC-1', warehouseId: 'WH-1' },
        { id: 'LOC-2', warehouseId: 'WH-2' }
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);
      prismaMock.demandForecast.findMany.mockResolvedValue([]);
      prismaMock.replenishmentRule.findMany.mockResolvedValue([]);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      });
      global.fetch = mockFetch;

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(result).toEqual({
        recommendations: [],
        matrix: {},
        summary: { totalTransfers: 0, totalCost: 0, skusImproved: 0, avgDocImprovement: 0 }
      });
    });
  });

  describe('Fallback Optimization Behavior (Sidecar Failure)', () => {
    beforeEach(() => {
      prismaMock.warehouseLocation.findMany.mockResolvedValue([
        { id: 'LOC-1', warehouseId: 'WH-1' },
        { id: 'LOC-2', warehouseId: 'WH-2' }
      ]);
    });

    it('falls back to basic calculations when sidecar request throws network error', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { sku: 'SKU-SURPLUS', locationId: 'LOC-1', quantity: 300, allocated: 0 },
        { sku: 'SKU-DEFICIT', locationId: 'LOC-2', quantity: 5, allocated: 0 },
        { sku: 'SKU-BALANCED', locationId: 'LOC-2', quantity: 20, allocated: 0 }
      ]);

      prismaMock.demandForecast.findMany.mockResolvedValue([
        { sku: 'SKU-SURPLUS', locationId: 'LOC-1', forecastedQuantity: 30 },
        { sku: 'SKU-DEFICIT', locationId: 'LOC-2', forecastedQuantity: 30 },
        { sku: 'SKU-BALANCED', locationId: 'LOC-2', forecastedQuantity: 30 }
      ]);

      prismaMock.replenishmentRule.findMany.mockResolvedValue([]);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[GQL RebalanceOptimization] Sidecar unavailable, using fallback')
      );

      expect(result.recommendations).toEqual([]);
      expect(result.summary).toEqual({
        totalTransfers: 0,
        totalCost: 0,
        skusImproved: 0,
        avgDocImprovement: 0
      });

      expect(result.matrix['WH-1']['SKU-SURPLUS'].status).toBe('SURPLUS');
      expect(result.matrix['WH-2']['SKU-DEFICIT'].status).toBe('DEFICIT');
      expect(result.matrix['WH-2']['SKU-BALANCED'].status).toBe('BALANCED');

      consoleSpy.mockRestore();
    });

    it('handles stock items with missing demand velocity by assigning default high DOC of 9999', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { sku: 'SKU-NO-FORECAST', locationId: 'LOC-1', quantity: 50, allocated: 5 }
      ]);

      prismaMock.demandForecast.findMany.mockResolvedValue([]);
      prismaMock.replenishmentRule.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(result.matrix['WH-1']['SKU-NO-FORECAST']).toEqual({
        onHand: 50,
        available: 45,
        doc: 9999,
        status: 'SURPLUS'
      });
    });

    it('safely calculates DOC when stock items have missing allocated or inTransit properties', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        { sku: 'SKU-PARTIAL', locationId: 'LOC-1', quantity: 15 }
      ]);

      prismaMock.demandForecast.findMany.mockResolvedValue([
        { sku: 'SKU-PARTIAL', locationId: 'LOC-1', forecastedQuantity: 30 }
      ]);

      prismaMock.replenishmentRule.findMany.mockResolvedValue([]);

      global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

      const result = await service.getRebalanceMatrix('tenant-1');

      expect(result.matrix['WH-1']['SKU-PARTIAL']).toEqual({
        onHand: 15,
        available: 15,
        doc: 15,
        status: 'BALANCED'
      });
    });
  });
});
