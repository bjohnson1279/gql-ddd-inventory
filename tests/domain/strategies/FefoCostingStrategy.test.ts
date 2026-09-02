import { FefoCostingStrategy } from '../../../src/domain/strategies/FefoCostingStrategy';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { Lot } from '../../../src/domain/valueObjects/Lot';

describe('FefoCostingStrategy', () => {
  let strategy: FefoCostingStrategy;
  const variantId = new ProductVariantId('v1');

  beforeEach(() => {
    strategy = new FefoCostingStrategy();
  });

  const createLayer = (id: string, initialQty: number, unitCost: number, receivedAt: Date, consumedQty = 0, lot?: Lot) => {
    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(id),
      variantId,
      initialQty,
      unitCost,
      receivedAt,
      undefined,
      lot
    );
    if (consumedQty > 0) {
      layer.consume(consumedQty);
    }
    return layer;
  };

  describe('calculateCost', () => {
    it('should calculate cost correctly from a single layer', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'), 0, lot1)
      ];
      const breakdown = strategy.calculateCost(layers, 5, variantId);
      expect(breakdown.quantity).toBe(5);
      expect(breakdown.totalCostCents).toBe(500);
      expect(breakdown.averageUnitCostCents).toBe(100);
    });

    it('should calculate cost spanning multiple layers in FEFO order', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const lot2 = new Lot('LOT2', new Date('2023-10-01'));
      const lot3 = new Lot('LOT3', new Date('2023-11-01'));

      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'), 0, lot1),
        createLayer('layer2', 5, 150, new Date('2023-01-02'), 0, lot2),
        createLayer('layer3', 10, 200, new Date('2023-01-03'), 0, lot3)
      ];
      const breakdown = strategy.calculateCost(layers, 12, variantId);
      expect(breakdown.quantity).toBe(12);
      expect(breakdown.totalCostCents).toBe(2150);
    });

    it('should put layers without lot or expiration date at the end', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));

      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01')),
        createLayer('layer2', 5, 150, new Date('2023-01-02'), 0, lot1),
      ];

      const breakdown = strategy.calculateCost(layers, 7, variantId);
      expect(breakdown.quantity).toBe(7);
      expect(breakdown.totalCostCents).toBe(950);
    });

    it('should calculate cost accounting for already consumed quantities', () => {
      const lot1 = new Lot('LOT1', new Date('2023-10-01'));
      const lot2 = new Lot('LOT2', new Date('2023-12-01'));

      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'), 4, lot1),
        createLayer('layer2', 10, 150, new Date('2023-01-02'), 0, lot2)
      ];
      const breakdown = strategy.calculateCost(layers, 8, variantId);
      expect(breakdown.quantity).toBe(8);
      expect(breakdown.totalCostCents).toBe(900);
    });

    it('should throw an error if there are insufficient cost layers', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'), 0, lot1)
      ];
      expect(() => {
        strategy.calculateCost(layers, 10, variantId);
      }).toThrow('Insufficient cost layers to cover the quantity.');
    });

    it('should calculate cost of 0 when quantity is 0', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'), 0, lot1)
      ];
      const breakdown = strategy.calculateCost(layers, 0, variantId);
      expect(breakdown.quantity).toBe(0);
      expect(breakdown.totalCostCents).toBe(0);
    });
  });

  describe('consumeLayers', () => {
    it('should consume layers and return breakdown and sorted layers', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const lot2 = new Lot('LOT2', new Date('2023-10-01'));

      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'), 0, lot1),
        createLayer('layer2', 10, 150, new Date('2023-01-02'), 0, lot2)
      ];
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 7, variantId);
      expect(breakdown.quantity).toBe(7);
      expect(breakdown.totalCostCents).toBe(1050);

      expect(sortedLayers[0].id.value).toBe('layer2');
      expect(sortedLayers[0].remainingQuantity()).toBe(3);

      expect(sortedLayers[1].id.value).toBe('layer1');
      expect(sortedLayers[1].remainingQuantity()).toBe(5);
    });

    it('should throw an error if there are insufficient cost layers to consume', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'), 0, lot1)
      ];
      expect(() => {
        strategy.consumeLayers(layers, 10, variantId);
      }).toThrow('Insufficient cost layers to cover the quantity.');
    });

    it('should break early if quantity is fulfilled before checking all layers', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const lot2 = new Lot('LOT2', new Date('2023-10-01'));
      const lot3 = new Lot('LOT3', new Date('2023-11-01'));

      const layers = [
        createLayer('layer1', 5, 100, new Date('2023-01-01'), 0, lot1),
        createLayer('layer2', 10, 150, new Date('2023-01-02'), 0, lot2),
        createLayer('layer3', 10, 200, new Date('2023-01-03'), 0, lot3)
      ];
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 12, variantId);

      expect(breakdown.quantity).toBe(12);
      expect(breakdown.totalCostCents).toBe(1900);

      expect(sortedLayers[0].id.value).toBe('layer2');
      expect(sortedLayers[0].remainingQuantity()).toBe(0);

      expect(sortedLayers[1].id.value).toBe('layer3');
      expect(sortedLayers[1].remainingQuantity()).toBe(8);

      expect(sortedLayers[2].id.value).toBe('layer1');
      expect(sortedLayers[2].remainingQuantity()).toBe(5);
    });

    it('should consume 0 layers and return breakdown of 0 when quantity is 0', () => {
      const lot1 = new Lot('LOT1', new Date('2023-12-01'));
      const layers = [
        createLayer('layer1', 10, 100, new Date('2023-01-01'), 0, lot1)
      ];
      const { breakdown, sortedLayers } = strategy.consumeLayers(layers, 0, variantId);
      expect(breakdown.quantity).toBe(0);
      expect(breakdown.totalCostCents).toBe(0);
      expect(sortedLayers[0].remainingQuantity()).toBe(10);
    });
  });
});
