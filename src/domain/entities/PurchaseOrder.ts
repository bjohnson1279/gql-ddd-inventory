import { PurchaseOrderId } from '../valueObjects/PurchaseOrderId';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';
import { PurchaseOrderStatus } from '../enums/PurchaseOrderStatus';
import { PurchaseOrderItem } from '../valueObjects/PurchaseOrderItem';

export class PurchaseOrder {
  private _status: PurchaseOrderStatus;

  constructor(
    public readonly id: PurchaseOrderId,
    public readonly tenantId: TenantId,
    public readonly supplierId: string,
    public readonly destinationLocationId: LocationId,
    public readonly items: PurchaseOrderItem[],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    if (!supplierId || supplierId.trim().length === 0) {
      throw new Error("Supplier ID cannot be empty.");
    }
    if (items.length === 0) {
      throw new Error("Purchase order must contain at least one item.");
    }
    this._status = PurchaseOrderStatus.Draft;
  }

  get status(): PurchaseOrderStatus {
    return this._status;
  }

  place(): void {
    if (this._status !== PurchaseOrderStatus.Draft) {
      throw new Error(`Cannot place a purchase order in status: ${this._status}`);
    }
    this._status = PurchaseOrderStatus.Ordered;
  }

  receive(): void {
    if (this._status !== PurchaseOrderStatus.Ordered) {
      throw new Error(`Cannot receive a purchase order in status: ${this._status}`);
    }
    this._status = PurchaseOrderStatus.Received;
  }

  cancel(): void {
    if (this._status === PurchaseOrderStatus.Received || this._status === PurchaseOrderStatus.Cancelled) {
      throw new Error(`Cannot cancel a purchase order in status: ${this._status}`);
    }
    this._status = PurchaseOrderStatus.Cancelled;
  }

  static reconstruct(
    id: PurchaseOrderId,
    tenantId: TenantId,
    supplierId: string,
    destinationLocationId: LocationId,
    items: PurchaseOrderItem[],
    status: PurchaseOrderStatus,
    createdAt: Date,
    updatedAt: Date
  ): PurchaseOrder {
    const po = new PurchaseOrder(id, tenantId, supplierId, destinationLocationId, items, createdAt, updatedAt);
    po._status = status;
    return po;
  }

  static createNew(
    id: PurchaseOrderId,
    tenantId: TenantId,
    supplierId: string,
    destinationLocationId: LocationId,
    items: PurchaseOrderItem[]
  ): PurchaseOrder {
    return new PurchaseOrder(id, tenantId, supplierId, destinationLocationId, items);
  }
}
