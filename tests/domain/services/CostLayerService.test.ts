import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { CostLayerService } from '../../../src/domain/services/CostLayerService';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { Lot } from '../../../src/domain/valueObjects/Lot';
import { CostingMethod } from '../../../src/domain/enums/AccountingEnums';

class MockLayerRepo implements IInventoryCostLayerRepository {
  public layers: InventoryCostLayer[] = [];
  async save(layer: InventoryCostLayer): Promise<void> {}
  async saveBatch(layers: InventoryCostLayer[]): Promise<void> {}
  async getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]> {
    let result = this.layers.filter(l => l.variantId.equals(variantId) && !l.isFullyConsumed());
    if (orderBy?.includes('expiration_date')) {
      result.sort((a, b) => {
        const expA = a.lot?.expirationDate.getTime() || Infinity;
        const expB = b.lot?.expirationDate.getTime() || Infinity;
        if (expA !== expB) {
          return expA - expB;
        }
        return a.receivedAt.getTime() - b.receivedAt.getTime();
      });
    } else if (orderBy?.includes('received_at')) {
      const isDesc = orderBy.includes('DESC');
      result.sort((a, b) => {
        const tA = a.receivedAt.getTime();
        const tB = b.receivedAt.getTime();
        return isDesc ? tB - tA : tA - tB;
      });
    }
    return result;
  }
  async getActiveLayersBatch(variantIds: ProductVariantId[], orderBy?: string): Promise<Map<string, InventoryCostLayer[]>> {
    const map = new Map<string, InventoryCostLayer[]>();
    for (const vId of variantIds) {
      map.set(vId.value, await this.getActiveLayers(vId, orderBy));
    }
    return map;
  }
  async findBySerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<InventoryCostLayer | null> {
    return this.layers.find(l => l.variantId.equals(variantId) && l.serialNumber?.equals(serialNumber)) || null;
  }
}

describe('CostLayerService', () => {
  const v1 = new ProductVariantId('V1');
  const v2 = new ProductVariantId('V2');

  let repo: MockLayerRepo;
  let service: CostLayerService;

  beforeEach(() => {
    repo = new MockLayerRepo();
    repo.save = jest.fn().mockResolvedValue(undefined);
    repo.saveBatch = jest.fn().mockResolvedValue(undefined);
    service = new CostLayerService(repo);
  });

  describe('calculateCost', () => {
    it('should route to calculateWeightedAverageCost when method is WeightedAverageCost', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date()),
      ];
      const spy = jest.spyOn(service, 'calculateWeightedAverageCost');
      const cost = await service.calculateCost(v1, 5, CostingMethod.WeightedAverageCost);
      expect(spy).toHaveBeenCalledWith(v1, 5);
      expect(cost.totalCostCents).toBe(500);
    });

    it('should correctly use LIFO order', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')), // Older, $1
        new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01')), // Newer, $2
      ];
      // LIFO: take from L2 first
      const cost = await service.calculateCost(v1, 5, CostingMethod.LIFO);
      expect(cost.totalCostCents).toBe(1000); // 5 * $2
    });

    it('should use FIFO order by default', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')),
        new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01')),
      ];
      const cost = await service.calculateCost(v1, 5);
      expect(cost.totalCostCents).toBe(500); // 5 * $1
    });
  });

  describe('consumeLayers', () => {
    it('should route to consumeLayers(..., FIFO) when method is WeightedAverageCost', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')),
      ];
      const cost = await service.consumeLayers(v1, 5, CostingMethod.WeightedAverageCost);
      // Even though requested WAC, it consumes FIFO behind the scenes
      expect(cost.totalCostCents).toBe(500);
      expect(repo.layers[0].remainingQuantity()).toBe(5);
    });

    it('should correctly use LIFO order and save changes', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')),
        new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01')),
      ];
      const cost = await service.consumeLayers(v1, 15, CostingMethod.LIFO);
      // LIFO: 10 * 200 + 5 * 100 = 2500
      expect(cost.totalCostCents).toBe(2500);
      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(repo.layers[1].remainingQuantity()).toBe(0); // L2 consumed first
      expect(repo.layers[0].remainingQuantity()).toBe(5);
    });
  });

  describe('consumeLayersBatch', () => {
    it('should consume layers for multiple items with different costing methods', async () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')); // V1 FIFO
      const l2 = new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01'));
      const l3 = new InventoryCostLayer(new InventoryCostLayerId('L3'), v2, 10, 300, new Date('2024-01-01')); // V2 LIFO
      const l4 = new InventoryCostLayer(new InventoryCostLayerId('L4'), v2, 10, 400, new Date('2024-02-01'));
      repo.layers = [l1, l2, l3, l4];

      const methodsMap = new Map<string, CostingMethod>();
      methodsMap.set(v1.value, CostingMethod.FIFO);
      methodsMap.set(v2.value, CostingMethod.LIFO);

      const items = [
        { variantId: v1, quantity: 15 },
        { variantId: v2, quantity: 15 }
      ];

      const { breakdowns, totalCostCents } = await service.consumeLayersBatch(items, methodsMap);

      // V1 FIFO: 10 * 100 + 5 * 200 = 2000
      // V2 LIFO: 10 * 400 + 5 * 300 = 5500
      // Total = 7500
      expect(totalCostCents).toBe(7500);
      expect(breakdowns.get(v1.value)?.totalCostCents).toBe(2000);
      expect(breakdowns.get(v2.value)?.totalCostCents).toBe(5500);

      expect(l1.remainingQuantity()).toBe(0);
      expect(l2.remainingQuantity()).toBe(5);
      expect(l4.remainingQuantity()).toBe(0); // L4 consumed first due to LIFO
      expect(l3.remainingQuantity()).toBe(5);

      expect(repo.saveBatch).toHaveBeenCalledWith(expect.arrayContaining([l1, l2, l4, l3]));
    });

    it('should default to FIFO for batch items if no method specified', async () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'));
      repo.layers = [l1];

      const { totalCostCents } = await service.consumeLayersBatch([{ variantId: v1, quantity: 5 }]);
      expect(totalCostCents).toBe(500);
    });

    it('should use FEFO when method is FEFO in batch', async () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'), undefined, new Lot('L1', new Date('2026-01-01'))); // Exp later
      const l2 = new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01'), undefined, new Lot('L2', new Date('2025-01-01'))); // Exp sooner
      repo.layers = [l1, l2];

      const methodsMap = new Map<string, CostingMethod>();
      methodsMap.set(v1.value, CostingMethod.FEFO);

      const { totalCostCents } = await service.consumeLayersBatch([{ variantId: v1, quantity: 5 }], methodsMap);
      expect(totalCostCents).toBe(1000); // 5 * 200 (L2)
    });
  });

  describe('calculateConsumedCost (private method, tested via calculateCost)', () => {
    it('should throw error when insufficient cost layers to cover quantity', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'))
      ];
      await expect(service.calculateCost(v1, 15)).rejects.toThrow('Insufficient cost layers to cover the quantity.');
    });
  });

  describe('calculateFifoCost', () => {
    it('should call calculateCost with FIFO method', async () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'));
      repo.layers = [l1];
      const cost = await service.calculateFifoCost(v1, 5);
      expect(cost.totalCostCents).toBe(500);
    });

    it('should mathematically correctly calculate complex FIFO cost across multiple layers', async () => {
      repo.layers = [
        new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')), // Older, $1
        new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01')), // Newer, $2
        new InventoryCostLayer(new InventoryCostLayerId('L3'), v1, 10, 300, new Date('2024-03-01')), // Newest, $3
      ];
      // Need 25 units. FIFO: 10 * 100 + 10 * 200 + 5 * 300 = 1000 + 2000 + 1500 = 4500
      const cost = await service.calculateFifoCost(v1, 25);
      expect(cost.totalCostCents).toBe(4500);
    });
  });

  describe('consumeFifoLayers', () => {
    it('should call consumeLayers with FIFO method', async () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'));
      repo.layers = [l1];
      const cost = await service.consumeFifoLayers(v1, 5);
      expect(cost.totalCostCents).toBe(500);
      expect(l1.remainingQuantity()).toBe(5);
    });
  });

  describe('consumeFifoLayersBatch', () => {
    it('should call consumeLayersBatch with items and default FIFO', async () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'));
      repo.layers = [l1];

      const { totalCostCents } = await service.consumeFifoLayersBatch([{ variantId: v1, quantity: 5 }]);
      expect(totalCostCents).toBe(500);
    });
  });

  describe('calculateWeightedAverageCostSync', () => {
    it('should throw error if total units are zero without variantIdValue', () => {
      expect(() => {
        service.calculateWeightedAverageCostSync([], 5);
      }).toThrow('Insufficient inventory for variant ');
    });

    it('should throw error if total units are zero with variantIdValue', () => {
      expect(() => {
        service.calculateWeightedAverageCostSync([], 5, 'V123');
      }).toThrow('Insufficient inventory for variant V123');
    });

    it('should successfully calculate average cost', () => {
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date());
      const l2 = new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date());
      const breakdown = service.calculateWeightedAverageCostSync([l1, l2], 5, v1.value);
      // Avg: (10*100 + 10*200)/20 = 150. 5 * 150 = 750
      expect(breakdown.totalCostCents).toBe(750);
    });
  });

  describe('calculateWeightedAverageCost', () => {
    it('should throw an error with variantId if insufficient layers available', async () => {
      repo.layers = [];
      await expect(service.calculateWeightedAverageCost(v1, 5))
        .rejects.toThrow('Insufficient inventory for variant V1');
    });
  });

  describe('costForSerial', () => {
    it('should return cost for existing serial', async () => {
      const sn = new SerialNumber('SN123');
      const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 1, 1500, new Date(), sn);
      repo.layers = [l1];
      const cost = await service.costForSerial(v1, sn);
      expect(cost.totalCostCents).toBe(1500);
    });

    it('should throw error if serial is not found', async () => {
      const sn = new SerialNumber('SN999');
      await expect(service.costForSerial(v1, sn))
        .rejects.toThrow('No cost layer found for serial SN999');
    });
  });
});
