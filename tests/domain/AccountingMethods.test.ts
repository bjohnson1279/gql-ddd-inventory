import { InventoryCostLayer, InventoryCostLayerId } from '../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { CostLayerService } from '../../src/domain/services/CostLayerService';
import { IInventoryCostLayerRepository } from '../../src/domain/repositories/IInventoryCostLayerRepository';
import { SerialNumber } from '../../src/domain/valueObjects/SerialNumber';

class MockLayerRepo implements IInventoryCostLayerRepository {
  public layers: InventoryCostLayer[] = [];
  async save(layer: InventoryCostLayer): Promise<void> {}
  async saveBatch(layers: InventoryCostLayer[]): Promise<void> {}
  async getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]> {
    let result = this.layers.filter(l => l.variantId.equals(variantId) && !l.isFullyConsumed());
    if (orderBy === 'received_at ASC') {
      result.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
    }
    return result;
  }
  async findBySerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<InventoryCostLayer | null> {
    return this.layers.find(l => l.variantId.equals(variantId) && l.serialNumber?.equals(serialNumber)) || null;
  }
}

describe('Accounting Methods (Cost Layers)', () => {
  const v1 = new ProductVariantId('V1');

  it('should calculate FIFO cost correctly', async () => {
    const repo = new MockLayerRepo();
    repo.layers = [
      new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01')), // $1.00
      new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01')), // $2.00
    ];
    const service = new CostLayerService(repo);

    // Sale of 15 units: 10 * $1.00 + 5 * $2.00 = 1000 + 1000 = 2000 cents ($20.00)
    const cost = await service.calculateFifoCost(v1, 15);
    expect(cost.totalCostCents).toBe(2000);
  });

  it('should calculate Weighted Average Cost correctly', async () => {
    const repo = new MockLayerRepo();
    repo.layers = [
      new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date()),
      new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date()),
    ];
    const service = new CostLayerService(repo);

    // Total units: 20, Total value: 1000 + 2000 = 3000. Avg cost: 150.
    // Sale of 5 units: 5 * 150 = 750 cents.
    const cost = await service.calculateWeightedAverageCost(v1, 5);
    expect(cost.totalCostCents).toBe(750);
  });

  it('should consume FIFO layers and persist changes', async () => {
    const repo = new MockLayerRepo();
    const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date('2024-01-01'));
    const l2 = new InventoryCostLayer(new InventoryCostLayerId('L2'), v1, 10, 200, new Date('2024-02-01'));
    repo.layers = [l1, l2];
    repo.save = jest.fn().mockResolvedValue(undefined);
    const service = new CostLayerService(repo);

    const cost = await service.consumeFifoLayers(v1, 15);
    expect(cost.totalCostCents).toBe(2000);
    expect(l1.remainingQuantity()).toBe(0);
    expect(l2.remainingQuantity()).toBe(5);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('should get cost for a specific serial number', async () => {
    const repo = new MockLayerRepo();
    const sn = new SerialNumber('SN-1');
    const l1 = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 1, 5000, new Date(), sn);
    repo.layers = [l1];
    const service = new CostLayerService(repo);

    const cost = await service.costForSerial(v1, sn);
    expect(cost.totalCostCents).toBe(5000);
  });

  it('should throw error when insufficient layers available', async () => {
    const repo = new MockLayerRepo();
    repo.layers = [new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 5, 100, new Date())];
    const service = new CostLayerService(repo);

    await expect(service.calculateFifoCost(v1, 10)).rejects.toThrow('Insufficient cost layers');
  });

  describe('InventoryCostLayer', () => {
    it('should throw error for non-positive initial quantity', () => {
      expect(() => new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 0, 100, new Date()))
        .toThrow('Initial quantity must be positive');
    });

    it('should throw error for negative unit cost', () => {
      expect(() => new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, -1, new Date()))
        .toThrow('Unit cost cannot be negative');
    });

    it('should correctly report if fully consumed', () => {
      const layer = new InventoryCostLayer(new InventoryCostLayerId('L1'), v1, 10, 100, new Date());
      expect(layer.isFullyConsumed()).toBe(false);
      
      const consumed = layer.consume(5);
      expect(consumed).toBe(5);
      expect(layer.consumedQuantity).toBe(5);
      expect(layer.remainingQuantity()).toBe(5);
      expect(layer.remainingCostCents()).toBe(500);
      expect(layer.isFullyConsumed()).toBe(false);

      const consumed2 = layer.consume(10); // Attempt to consume more than remaining
      expect(consumed2).toBe(5);
      expect(layer.isFullyConsumed()).toBe(true);
    });
  });
});
