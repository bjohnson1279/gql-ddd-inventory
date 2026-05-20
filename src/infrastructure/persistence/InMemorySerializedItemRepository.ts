import { ISerializedItemRepository } from '../../domain/repositories/ISerializedItemRepository';
import { SerializedItem } from '../../domain/entities/SerializedItem';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { SerializedItemStatus } from '../../domain/enums/SerializedItemStatus';

export class InMemorySerializedItemRepository implements ISerializedItemRepository {
  private items: SerializedItem[] = [];

  async save(item: SerializedItem): Promise<void> {
    const index = this.items.findIndex(i => i.id.equals(item.id));
    if (index !== -1) {
      this.items[index] = item;
    } else {
      this.items.push(item);
    }
  }

  async findBySerial(serialNumber: SerialNumber, tenantId: TenantId): Promise<SerializedItem | null> {
    return this.items.find(i => i.serialNumber.equals(serialNumber) && i.tenantId.equals(tenantId)) || null;
  }

  async isRegistered(serialNumber: SerialNumber, tenantId: TenantId): Promise<boolean> {
    return this.items.some(i => i.serialNumber.equals(serialNumber) && i.tenantId.equals(tenantId));
  }

  async countByStatus(variantId: ProductVariantId, status: SerializedItemStatus): Promise<number> {
    return this.items.filter(i => i.variantId.equals(variantId) && i.status === status).length;
  }
}
