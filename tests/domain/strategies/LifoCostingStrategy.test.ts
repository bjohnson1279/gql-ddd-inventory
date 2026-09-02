import { LifoCostingStrategy } from '../../../src/domain/strategies/LifoCostingStrategy';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';

describe('LifoCostingStrategy', () => {
  let strategy: LifoCostingStrategy;
  const variantId = new ProductVariantId('v1');

  beforeEach(() => {
    strategy = new LifoCostingStrategy();
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

    it('should calculate cost spanning multiple layers in LIFO order', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01')),
        createLayer('layer2', 10, 150, new Date('2023-01-02')),
        createLayer('layer3', 10, 200, new Date('2023-01-03'))
      ];
      // Expect 10 from layer3 and 2 from layer2
      const breakdown = strategy.calculateCost(layers, 12, variantId);
      expect(breakdown.quantity).toBe(12);
      expect(breakdown.totalCostCents).toBe(2300); // 10*200 + 2*150 = 2000 + 300 = 2300
      expect(breakdown.totalCostCents).toBe(2300); // 10*200 (layer3) + 2*150 (layer2)
    });

    it('should calculate cost accounting for already consumed quantities', () => {
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01')),
        createLayer('layer2', 10, 150, new Date('2023-01-02'), 4) // 6 remaining
      ];
      // Will take 6 from layer2 (newest) and 2 from layer1
      const breakdown = strategy.calculateCost(layers, 8, variantId);
      expect(breakdown.quantity).toBe(8);
      expect(breakdown.totalCostCents).toBe(1100); // 6*150 + 2*100 = 900 + 200 = 1100
        createLayer('layer2', 10, 150, new Date('2023-01-02'), 4)
      expect(breakdown.totalCostCents).toBe(1100); // 6*150 (layer2) + 2*100 (layer1)
    });

    it('should throw an error if there are insufficient cost layers', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'))
      ];
      expect(() => {
        strategy.calculateCost(layers, 10, variantId);
      }).toThrow('Insufficient cost layers to cover the quantity.');
    });

    it('should calculate cost of 0 when quantity is 0', () => {
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'))
      ];
      const breakdown = strategy.calculateCost(layers, 0, variantId);
      expect(breakdown.quantity).toBe(0);
      expect(breakdown.totalCostCents).toBe(0);
    });
  });

  describe('consumeLayers', () => {
    it('should consume layers and return breakdown and sorted layers in LIFO order', () => {
    it('should consume layers in LIFO order and return breakdown and sorted layers', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01')),
        createLayer('layer2', 10, 150, new Date('2023-01-02'))
      ];
      // Takes 7 from layer2 (newest), leaving 3 in layer2 and 5 in layer1
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 7, variantId);
      expect(breakdown.quantity).toBe(7);
      expect(breakdown.totalCostCents).toBe(1050); // 7*150 = 1050

      expect(sortedLayers[0].id.value).toBe('layer2');
      expect(sortedLayers[0].remainingQuantity()).toBe(3);

      expect(sortedLayers[1].id.value).toBe('layer1');
      expect(sortedLayers[1].remainingQuantity()).toBe(5);
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 12, variantId);
      expect(breakdown.quantity).toBe(12);
      expect(breakdown.totalCostCents).toBe(1700); // 10*150 (layer2) + 2*100 (layer1)
      expect(breakdown.averageUnitCostCents).toBe(142);

      expect(sortedLayers[0].remainingQuantity()).toBe(0);

      expect(sortedLayers[1].remainingQuantity()).toBe(3);
    });

    it('should throw an error if there are insufficient cost layers to consume', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'))
      ];
      expect(() => {
        strategy.consumeLayers(layers, 10, variantId);
      }).toThrow('Insufficient cost layers to cover the quantity.');
    });

    it('should break early if quantity is fulfilled before checking all layers', () => {
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01')),
        createLayer('layer2', 10, 150, new Date('2023-01-02')),
        createLayer('layer3', 10, 200, new Date('2023-01-03'))
      ];
      // Will consume 7 from layer3 (newest). Layer2 and Layer1 remain untouched.
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 7, variantId);
      expect(breakdown.quantity).toBe(7);
      expect(breakdown.totalCostCents).toBe(1400); // 7*200 = 1400
      // Need 7. Should consume 7 of layer3 and stop.
      expect(breakdown.totalCostCents).toBe(1400); // 7*200

      expect(sortedLayers[0].id.value).toBe('layer3');
      expect(sortedLayers[0].remainingQuantity()).toBe(3);

      expect(sortedLayers[1].id.value).toBe('layer2');
      expect(sortedLayers[1].remainingQuantity()).toBe(10);

      expect(sortedLayers[2].id.value).toBe('layer1');
      expect(sortedLayers[2].remainingQuantity()).toBe(5);
    });

    it('should consume 0 layers and return breakdown of 0 when quantity is 0', () => {
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'))
      ];
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 0, variantId);
      expect(breakdown.quantity).toBe(0);
      expect(breakdown.totalCostCents).toBe(0);
      expect(sortedLayers[0].remainingQuantity()).toBe(10);
    });
  });
});
