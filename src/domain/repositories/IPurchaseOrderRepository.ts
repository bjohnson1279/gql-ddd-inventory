import { PurchaseOrder } from '../entities/PurchaseOrder';
import { PurchaseOrderId } from '../valueObjects/PurchaseOrderId';
import { TenantId } from '../valueObjects/TenantId';

export interface IPurchaseOrderRepository {
  save(order: PurchaseOrder): Promise<void>;
  findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  findAllByTenant(tenantId: TenantId): Promise<PurchaseOrder[]>;
}
