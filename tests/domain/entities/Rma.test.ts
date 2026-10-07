import { Rma } from '../../../src/domain/entities/Rma';
import { RmaItem } from '../../../src/domain/entities/RmaItem';
import { RMAStatus, RMADisposition, RMAItemStatus } from '../../../src/domain/enums/ReturnEnums';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';

describe('Rma', () => {
  const tenantId = new TenantId('tenant-1');
  const locationId = new LocationId('loc-1');
  const variantId1 = new ProductVariantId('var-1');
  const variantId2 = new ProductVariantId('var-2');

  const createSampleItem = (id: string, variant: ProductVariantId, qty: number = 2) => {
    return new RmaItem(id, variant, qty, 1000);
  };

  describe('constructor and getters', () => {
    it('should initialize with default values when optional parameters are omitted', () => {
      const rma = new Rma('rma-1', 'RMA-100', tenantId, 'cust-1', locationId);

      expect(rma.id).toBe('rma-1');
      expect(rma.rmaNumber).toBe('RMA-100');
      expect(rma.tenantId).toBe(tenantId);
      expect(rma.customerId).toBe('cust-1');
      expect(rma.locationId).toBe(locationId);
      expect(rma.status).toBe(RMAStatus.Requested);
      expect(rma.items).toEqual([]);
      expect(rma.createdAt).toBeInstanceOf(Date);
      expect(rma.updatedAt).toBeInstanceOf(Date);
    });

    it('should initialize with provided status, items, createdAt, and updatedAt', () => {
      const item = createSampleItem('item-1', variantId1);
      const customCreated = new Date('2025-01-01');
      const customUpdated = new Date('2025-01-02');

      const rma = new Rma(
        'rma-1',
        'RMA-100',
        tenantId,
        'cust-1',
        locationId,
        RMAStatus.Authorized,
        [item],
        customCreated,
        customUpdated
      );

      expect(rma.status).toBe(RMAStatus.Authorized);
      expect(rma.items).toHaveLength(1);
      expect(rma.items[0]).toBe(item);
      expect(rma.createdAt).toBe(customCreated);
      expect(rma.updatedAt).toBe(customUpdated);
    });
  });

  describe('authorize', () => {
    it('should transition status from Requested to Authorized', () => {
      const rma = new Rma('rma-1', 'RMA-100', tenantId, 'cust-1', locationId);
      rma.authorize();
      expect(rma.status).toBe(RMAStatus.Authorized);
    });

    it('should throw an error when authorizing an RMA that is not in Requested status', () => {
      const rma = new Rma(
        'rma-1',
        'RMA-100',
        tenantId,
        'cust-1',
        locationId,
        RMAStatus.Authorized
      );
      expect(() => rma.authorize()).toThrow('Only requested RMAs can be authorized.');
    });
  });

  describe('receiveItem', () => {
    it('should throw an error if RMA status is not Authorized or Received', () => {
      const rma = new Rma('rma-1', 'RMA-100', tenantId, 'cust-1', locationId, RMAStatus.Requested);
      expect(() => rma.receiveItem('var-1', 1, RMADisposition.Restock)).toThrow(
        'Can only receive items on Authorized or partially Received RMAs.'
      );
    });

    it('should throw an error if the item is not found in the RMA', () => {
      const item = createSampleItem('item-1', variantId1);
      const rma = new Rma(
        'rma-1',
        'RMA-100',
        tenantId,
        'cust-1',
        locationId,
        RMAStatus.Authorized,
        [item]
      );
      expect(() => rma.receiveItem('non-existent-var', 1, RMADisposition.Restock)).toThrow(
        'Item non-existent-var not found in this RMA.'
      );
    });

    it('should partially receive item and update status to Received when not all items are processed', () => {
      const item1 = createSampleItem('item-1', variantId1, 5);
      const item2 = createSampleItem('item-2', variantId2, 5);
      const rma = new Rma(
        'rma-1',
        'RMA-100',
        tenantId,
        'cust-1',
        locationId,
        RMAStatus.Authorized,
        [item1, item2]
      );

      rma.receiveItem('var-1', 2, RMADisposition.Restock);

      expect(rma.status).toBe(RMAStatus.Received);
      expect(item1.receivedQuantity).toBe(2);
      expect(item1.disposition).toBe(RMADisposition.Restock);
    });

    it('should fully receive all items and update status to Completed when all items are processed', () => {
      const item1 = createSampleItem('item-1', variantId1, 2);
      const rma = new Rma(
        'rma-1',
        'RMA-100',
        tenantId,
        'cust-1',
        locationId,
        RMAStatus.Authorized,
        [item1]
      );

      rma.receiveItem('var-1', 2, RMADisposition.Scrap);

      expect(rma.status).toBe(RMAStatus.Completed);
      expect(item1.receivedQuantity).toBe(2);
      expect(item1.status).toBe(RMAItemStatus.Received);
    });
  });

  describe('reject', () => {
    it('should allow rejecting an RMA in Requested status', () => {
      const rma = new Rma('rma-1', 'RMA-100', tenantId, 'cust-1', locationId, RMAStatus.Requested);
      rma.reject();
      expect(rma.status).toBe(RMAStatus.Rejected);
    });

    it('should allow rejecting an RMA in Authorized status', () => {
      const rma = new Rma('rma-1', 'RMA-100', tenantId, 'cust-1', locationId, RMAStatus.Authorized);
      rma.reject();
      expect(rma.status).toBe(RMAStatus.Rejected);
    });

    it('should throw an error when rejecting an RMA that is in Received or Completed status', () => {
      const rma = new Rma('rma-1', 'RMA-100', tenantId, 'cust-1', locationId, RMAStatus.Received);
      expect(() => rma.reject()).toThrow('Cannot reject RMA after receipt has started.');
    });
  });
});
