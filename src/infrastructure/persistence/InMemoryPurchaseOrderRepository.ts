import { IPurchaseOrderRepository } from '../../domain/repositories/IPurchaseOrderRepository';
import { PurchaseOrder } from '../../domain/entities/PurchaseOrder';
import { PurchaseOrderId } from '../../domain/valueObjects/PurchaseOrderId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { PurchaseOrderItem } from '../../domain/valueObjects/PurchaseOrderItem';

export class InMemoryPurchaseOrderRepository implements IPurchaseOrderRepository {
  private readonly orders: Map<string, PurchaseOrder> = new Map();

  private cloneOrder(order: PurchaseOrder): PurchaseOrder {
    const items = order.items.map((i) => new PurchaseOrderItem(i.variantId, i.quantity));
    return PurchaseOrder.reconstruct(
      new PurchaseOrderId(order.id.value),
      new TenantId(order.tenantId.value),
      order.supplierId,
      new LocationId(order.destinationLocationId.value),
      items,
      order.status,
      order.createdAt,
      order.updatedAt
    );
  }

  async save(order: PurchaseOrder): Promise<void> {
    this.orders.set(order.id.value, order);
  }

  async findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const order = this.orders.get(id.value);
    return order ? this.cloneOrder(order) : null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<PurchaseOrder[]> {
    return Array.from(this.orders.values())
      .filter((o) => o.tenantId.equals(tenantId))
      .map((o) => this.cloneOrder(o));
  }
}
