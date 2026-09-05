import { PurchaseOrder } from '../../../src/domain/entities/PurchaseOrder';
import { PurchaseOrderId } from '../../../src/domain/valueObjects/PurchaseOrderId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { PurchaseOrderItem } from '../../../src/domain/valueObjects/PurchaseOrderItem';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { PurchaseOrderStatus } from '../../../src/domain/enums/PurchaseOrderStatus';

describe('PurchaseOrder', () => {
  const id = new PurchaseOrderId('po-1');
  const tenantId = new TenantId('tenant-1');
  const locationId = new LocationId('loc-1');
  const variantId = new ProductVariantId('var-1');
  const item = new PurchaseOrderItem(variantId, 10);
  const items = [item];
  const supplierId = 'supp-1';

  describe('constructor', () => {
    it('should create a PurchaseOrder with valid inputs', () => {
      const po = new PurchaseOrder(id, tenantId, supplierId, locationId, items);
      expect(po.id).toBe(id);
      expect(po.tenantId).toBe(tenantId);
      expect(po.supplierId).toBe(supplierId);
      expect(po.destinationLocationId).toBe(locationId);
      expect(po.items).toBe(items);
      expect(po.status).toBe(PurchaseOrderStatus.Draft);
      expect(po.createdAt).toBeInstanceOf(Date);
      expect(po.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if supplierId is empty', () => {
      expect(() => new PurchaseOrder(id, tenantId, '', locationId, items)).toThrow("Supplier ID cannot be empty.");
      expect(() => new PurchaseOrder(id, tenantId, '   ', locationId, items)).toThrow("Supplier ID cannot be empty.");
    });

    it('should throw an error if items array is empty', () => {
      expect(() => new PurchaseOrder(id, tenantId, supplierId, locationId, [])).toThrow("Purchase order must contain at least one item.");
    });
  });

  describe('state transitions', () => {
    let po: PurchaseOrder;

    beforeEach(() => {
      po = new PurchaseOrder(id, tenantId, supplierId, locationId, items);
    });

    it('should place a draft order', () => {
      po.place();
      expect(po.status).toBe(PurchaseOrderStatus.Ordered);
    });

    it('should throw when placing a non-draft order', () => {
      po.place();
      expect(() => po.place()).toThrow(`Cannot place a purchase order in status: ${PurchaseOrderStatus.Ordered}`);
    });

    it('should mark a draft order as pending approval', () => {
      po.markPendingApproval();
      expect(po.status).toBe(PurchaseOrderStatus.PendingApproval);
    });

    it('should throw when marking a non-draft order as pending approval', () => {
      po.place();
      expect(() => po.markPendingApproval()).toThrow('Cannot submit a non-draft purchase order for approval.');
    });

    it('should receive an ordered order', () => {
      po.place();
      po.receive();
      expect(po.status).toBe(PurchaseOrderStatus.Received);
    });

    it('should throw when receiving a non-ordered order', () => {
      expect(() => po.receive()).toThrow(`Cannot receive a purchase order in status: ${PurchaseOrderStatus.Draft}`);
    });

    it('should cancel a draft order', () => {
      po.cancel();
      expect(po.status).toBe(PurchaseOrderStatus.Cancelled);
    });

    it('should throw when cancelling a received order', () => {
      po.place();
      po.receive();
      expect(() => po.cancel()).toThrow(`Cannot cancel a purchase order in status: ${PurchaseOrderStatus.Received}`);
    });

    it('should throw when cancelling a cancelled order', () => {
      po.cancel();
      expect(() => po.cancel()).toThrow(`Cannot cancel a purchase order in status: ${PurchaseOrderStatus.Cancelled}`);
    });
  });

  describe('static methods', () => {
    it('should reconstruct a PurchaseOrder', () => {
      const createdAt = new Date('2023-01-01');
      const updatedAt = new Date('2023-01-02');
      const status = PurchaseOrderStatus.PendingApproval;
      const po = PurchaseOrder.reconstruct(id, tenantId, supplierId, locationId, items, status, createdAt, updatedAt);

      expect(po.id).toBe(id);
      expect(po.tenantId).toBe(tenantId);
      expect(po.supplierId).toBe(supplierId);
      expect(po.destinationLocationId).toBe(locationId);
      expect(po.items).toBe(items);
      expect(po.status).toBe(status);
      expect(po.createdAt).toBe(createdAt);
      expect(po.updatedAt).toBe(updatedAt);
    });

    it('should createNew PurchaseOrder', () => {
      const po = PurchaseOrder.createNew(id, tenantId, supplierId, locationId, items);

      expect(po.id).toBe(id);
      expect(po.tenantId).toBe(tenantId);
      expect(po.supplierId).toBe(supplierId);
      expect(po.destinationLocationId).toBe(locationId);
      expect(po.items).toBe(items);
      expect(po.status).toBe(PurchaseOrderStatus.Draft);
    });
  });
});
