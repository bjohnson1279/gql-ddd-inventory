import { RmaItem } from '../../../src/domain/entities/RmaItem';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { RMAItemStatus, RMADisposition } from '../../../src/domain/enums/ReturnEnums';

describe('RmaItem', () => {
  const variantId = new ProductVariantId('var-123');

  describe('constructor', () => {
    it('should initialize with default values when optional parameters are omitted', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);

      expect(item.id).toBe('rma-item-1');
      expect(item.variantId).toBe(variantId);
      expect(item.quantity).toBe(10);
      expect(item.unitCostCents).toBe(1500);
      expect(item.receivedQuantity).toBe(0);
      expect(item.status).toBe(RMAItemStatus.Pending);
      expect(item.disposition).toBeNull();
    });

    it('should initialize with provided custom optional parameters', () => {
      const item = new RmaItem(
        'rma-item-2',
        variantId,
        10,
        1500,
        5,
        RMAItemStatus.Received,
        RMADisposition.Restock
      );

      expect(item.receivedQuantity).toBe(5);
      expect(item.status).toBe(RMAItemStatus.Received);
      expect(item.disposition).toBe(RMADisposition.Restock);
    });

    it('should throw error when quantity is zero or negative', () => {
      expect(() => new RmaItem('item-1', variantId, 0, 100)).toThrow('Quantity must be greater than zero.');
      expect(() => new RmaItem('item-1', variantId, -5, 100)).toThrow('Quantity must be greater than zero.');
    });

    it('should throw error when unitCostCents is negative', () => {
      expect(() => new RmaItem('item-1', variantId, 10, -1)).toThrow('Unit cost cannot be negative.');
    });

    it('should throw error when receivedQuantity is negative', () => {
      expect(() => new RmaItem('item-1', variantId, 10, 100, -1)).toThrow('Received quantity cannot be negative.');
    });
  });

  describe('receive', () => {
    it('should throw error when receive amount is zero or negative', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);

      expect(() => item.receive(0, RMADisposition.Restock)).toThrow('Receive quantity must be greater than zero.');
      expect(() => item.receive(-1, RMADisposition.Restock)).toThrow('Receive quantity must be greater than zero.');
    });

    it('should throw error when receive amount exceeds remaining expected quantity', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500, 5);

      expect(() => item.receive(6, RMADisposition.Restock)).toThrow(
        'Cannot receive 6 units. Total received would exceed expected quantity of 10.'
      );
    });

    it('should partially receive items and set status to Pending', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);

      item.receive(4, RMADisposition.Quarantine);

      expect(item.receivedQuantity).toBe(4);
      expect(item.disposition).toBe(RMADisposition.Quarantine);
      expect(item.status).toBe(RMAItemStatus.Pending);
    });

    it('should fully receive items and set status to Received', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);

      item.receive(10, RMADisposition.Restock);

      expect(item.receivedQuantity).toBe(10);
      expect(item.disposition).toBe(RMADisposition.Restock);
      expect(item.status).toBe(RMAItemStatus.Received);
    });

    it('should transition status from Pending to Received upon reaching full quantity across multiple receives', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500, 6);

      item.receive(4, RMADisposition.Scrap);

      expect(item.receivedQuantity).toBe(10);
      expect(item.disposition).toBe(RMADisposition.Scrap);
      expect(item.status).toBe(RMAItemStatus.Received);
    });
  });

  describe('reject', () => {
    it('should set status to Rejected', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);

      item.reject();

      expect(item.status).toBe(RMAItemStatus.Rejected);
    });
  });

  describe('isFullyProcessed', () => {
    it('should return false when status is Pending', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);

      expect(item.isFullyProcessed()).toBe(false);
    });

    it('should return true when status is Received', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);
      item.receive(10, RMADisposition.Restock);

      expect(item.isFullyProcessed()).toBe(true);
    });

    it('should return true when status is Rejected', () => {
      const item = new RmaItem('rma-item-1', variantId, 10, 1500);
      item.reject();

      expect(item.isFullyProcessed()).toBe(true);
    });
  });
});
