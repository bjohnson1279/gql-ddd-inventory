import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { Lot } from '../../../src/domain/valueObjects/Lot';

describe('InventoryCostLayerId', () => {
  it('should construct valid InventoryCostLayerId', () => {
    const id = new InventoryCostLayerId('layer-123');
    expect(id.value).toBe('layer-123');
  });

  it('should throw error when given empty string or whitespace', () => {
    expect(() => new InventoryCostLayerId('')).toThrow('InventoryCostLayerId cannot be empty.');
    expect(() => new InventoryCostLayerId('   ')).toThrow('InventoryCostLayerId cannot be empty.');
  });

  it('should correctly evaluate equals()', () => {
    const id1 = new InventoryCostLayerId('layer-123');
    const id2 = new InventoryCostLayerId('layer-123');
    const id3 = new InventoryCostLayerId('layer-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});

describe('InventoryCostLayer', () => {
  const layerId = new InventoryCostLayerId('layer-1');
  const variantId = new ProductVariantId('var-1');
  const receivedAt = new Date('2025-01-01T00:00:00Z');

  it('should construct valid InventoryCostLayer with required fields', () => {
    const layer = new InventoryCostLayer(layerId, variantId, 100, 500, receivedAt);

    expect(layer.id).toBe(layerId);
    expect(layer.variantId).toBe(variantId);
    expect(layer.initialQuantity).toBe(100);
    expect(layer.unitCostCents).toBe(500);
    expect(layer.receivedAt).toBe(receivedAt);
    expect(layer.consumedQuantity).toBe(0);
    expect(layer.remainingQuantity()).toBe(100);
    expect(layer.remainingCostCents()).toBe(50000);
    expect(layer.isFullyConsumed()).toBe(false);
  });

  it('should accept optional serialNumber and lot', () => {
    const serial = new SerialNumber('SN-12345');
    const lot = new Lot('LOT-001', new Date('2026-01-01T00:00:00Z'));

    const layer = new InventoryCostLayer(layerId, variantId, 50, 1000, receivedAt, serial, lot);

    expect(layer.serialNumber).toBe(serial);
    expect(layer.lot).toBe(lot);
  });

  it('should throw error when initialQuantity is zero or negative', () => {
    expect(() => new InventoryCostLayer(layerId, variantId, 0, 500, receivedAt)).toThrow(
      'Initial quantity must be positive.'
    );
    expect(() => new InventoryCostLayer(layerId, variantId, -10, 500, receivedAt)).toThrow(
      'Initial quantity must be positive.'
    );
  });

  it('should throw error when unitCostCents is negative', () => {
    expect(() => new InventoryCostLayer(layerId, variantId, 10, -100, receivedAt)).toThrow(
      'Unit cost cannot be negative.'
    );
  });

  it('should allow unitCostCents of 0', () => {
    const layer = new InventoryCostLayer(layerId, variantId, 10, 0, receivedAt);
    expect(layer.unitCostCents).toBe(0);
    expect(layer.remainingCostCents()).toBe(0);
  });

  describe('consume', () => {
    it('should consume requested quantity when available and return consumed amount', () => {
      const layer = new InventoryCostLayer(layerId, variantId, 100, 200, receivedAt);

      const consumed = layer.consume(30);

      expect(consumed).toBe(30);
      expect(layer.consumedQuantity).toBe(30);
      expect(layer.remainingQuantity()).toBe(70);
      expect(layer.remainingCostCents()).toBe(14000);
      expect(layer.isFullyConsumed()).toBe(false);
    });

    it('should partially consume up to remaining quantity when requested quantity exceeds remaining', () => {
      const layer = new InventoryCostLayer(layerId, variantId, 50, 200, receivedAt);

      const consumed = layer.consume(80);

      expect(consumed).toBe(50);
      expect(layer.consumedQuantity).toBe(50);
      expect(layer.remainingQuantity()).toBe(0);
      expect(layer.remainingCostCents()).toBe(0);
      expect(layer.isFullyConsumed()).toBe(true);
    });

    it('should handle sequential consume calls until fully consumed', () => {
      const layer = new InventoryCostLayer(layerId, variantId, 10, 100, receivedAt);

      expect(layer.consume(4)).toBe(4);
      expect(layer.remainingQuantity()).toBe(6);

      expect(layer.consume(6)).toBe(6);
      expect(layer.remainingQuantity()).toBe(0);
      expect(layer.isFullyConsumed()).toBe(true);

      expect(layer.consume(5)).toBe(0);
      expect(layer.consumedQuantity).toBe(10);
    });
  });
});
