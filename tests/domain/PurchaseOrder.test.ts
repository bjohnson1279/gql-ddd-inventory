import { PurchaseOrder } from '../../src/domain/entities/PurchaseOrder';
import { PurchaseOrderId } from '../../src/domain/valueObjects/PurchaseOrderId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { PurchaseOrderItem } from '../../src/domain/valueObjects/PurchaseOrderItem';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { PurchaseOrderStatus } from '../../src/domain/enums/PurchaseOrderStatus';

describe('PurchaseOrder Aggregate Root', () => {
  const id = new PurchaseOrderId('po-1');
  const tenantId = new TenantId('T1');
  const loc = new LocationId('LOC-A');
  const items = [
    new PurchaseOrderItem(new ProductVariantId('v-1'), 100)
  ];

  it('should initialize draft PO correctly', () => {
    const po = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);

    expect(po.id.value).toBe('po-1');
    expect(po.supplierId).toBe('SUPP-1');
    expect(po.destinationLocationId.value).toBe('LOC-A');
    expect(po.status).toBe(PurchaseOrderStatus.Draft);
    expect(po.items).toHaveLength(1);
    expect(po.items[0].variantId.value).toBe('v-1');
    expect(po.items[0].quantity).toBe(100);
  });

  it('should throw error on invalid constructor arguments', () => {
    expect(() => {
      new PurchaseOrder(id, tenantId, ' ', loc, items);
    }).toThrow('Supplier ID cannot be empty.');

    expect(() => {
      new PurchaseOrder(id, tenantId, 'SUPP-1', loc, []);
    }).toThrow('Purchase order must contain at least one item.');
  });

  it('should transition status correctly through lifecycle', () => {
    const po = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);

    // Place
    po.place();
    expect(po.status).toBe(PurchaseOrderStatus.Ordered);

    // Receive
    po.receive();
    expect(po.status).toBe(PurchaseOrderStatus.Received);
  });

  it('should disallow placing non-draft POs', () => {
    const po = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);
    po.place();
    expect(() => po.place()).toThrow('Cannot place a purchase order in status: ORDERED');
  });

  it('should disallow receiving non-ordered POs', () => {
    const po = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);
    expect(() => po.receive()).toThrow('Cannot receive a purchase order in status: DRAFT');
  });

  it('should support cancellation from draft or ordered status', () => {
    const po1 = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);
    po1.cancel();
    expect(po1.status).toBe(PurchaseOrderStatus.Cancelled);

    const po2 = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);
    po2.place();
    po2.cancel();
    expect(po2.status).toBe(PurchaseOrderStatus.Cancelled);
  });

  it('should disallow cancelling received or already cancelled POs', () => {
    const po = PurchaseOrder.createNew(id, tenantId, 'SUPP-1', loc, items);
    po.place();
    po.receive();
    expect(() => po.cancel()).toThrow('Cannot cancel a purchase order in status: RECEIVED');
  });
});
