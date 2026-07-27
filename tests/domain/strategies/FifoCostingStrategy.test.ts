import { FifoCostingStrategy } from '../../../src/domain/strategies/FifoCostingStrategy';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';

describe('FifoCostingStrategy', () => {
  let strategy: FifoCostingStrategy;
  const variantId = new ProductVariantId('v1');

  beforeEach(() => {
    strategy = new FifoCostingStrategy();
  });

  const createLayer = (id: string, initialQty: number, unitCost: number, receivedAt: Date, consumedQty = 0) => {
    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(id),
      variantId,
      initialQty,
      unitCost,
      receivedAt
    );
    if (consumedQty > 0) {
      layer.consume(consumedQty);
    }
    return layer;
  };

  describe('calculateCost', () => {
    it('should calculate cost correctly from a single layer', () => {
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'))
      ];
      const breakdown = strategy.calculateCost(layers, 5, variantId);
      expect(breakdown.quantity).toBe(5);
      expect(breakdown.totalCostCents).toBe(500);
      expect(breakdown.averageUnitCostCents).toBe(100);
    });

    it('should calculate cost spanning multiple layers in FIFO order', () => {
      const layers = [
        createLayer('layer2', 10, 150, new Date('2023-01-02')),
        createLayer('layer1', 5, 100, new Date('2023-01-01')),
        createLayer('layer3', 10, 200, new Date('2023-01-03'))
      ];
      const breakdown = strategy.calculateCost(layers, 12, variantId);
      expect(breakdown.quantity).toBe(12);
      expect(breakdown.totalCostCents).toBe(1550); // 5*100 + 7*150
    });

    it('should calculate cost accounting for already consumed quantities', () => {
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'), 4),
        createLayer('layer2', 10, 150, new Date('2023-01-02'))
      ];
      const breakdown = strategy.calculateCost(layers, 8, variantId);
      expect(breakdown.quantity).toBe(8);
      expect(breakdown.totalCostCents).toBe(900); // 6*100 + 2*150
    });

    it('should throw an error if there are insufficient cost layers', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'))
      ];
      expect(() => {
        strategy.calculateCost(layers, 10, variantId);
      }).toThrow('Insufficient cost layers to cover the quantity.');
    });
  });

  describe('consumeLayers', () => {
    it('should consume layers and return breakdown and sorted layers', () => {
      const layers = [
        createLayer('layer2', 10, 150, new Date('2023-01-02')),
        createLayer('layer1', 5, 100, new Date('2023-01-01'))
      ];
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 7, variantId);
      expect(breakdown.quantity).toBe(7);
      expect(breakdown.totalCostCents).toBe(800); // 5*100 + 2*150

      expect(sortedLayers[0].id.value).toBe('layer1');
      expect(sortedLayers[0].remainingQuantity()).toBe(0);

      expect(sortedLayers[1].id.value).toBe('layer2');
      expect(sortedLayers[1].remainingQuantity()).toBe(8);
    });

    it('should throw an error if there are insufficient cost layers to consume', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'))
      ];
      expect(() => {
        strategy.consumeLayers(layers, 10, variantId);
      }).toThrow('Insufficient cost layers to cover the quantity.');
    });
  });
});
