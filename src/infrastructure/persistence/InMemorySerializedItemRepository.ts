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

  async saveBatch(items: SerializedItem[]): Promise<void> {
    for (const item of items) {
      await this.save(item);
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

  async findBySerialsAndVariantsBatch(pairs: { serialNumber: SerialNumber; variantId: ProductVariantId }[]): Promise<SerializedItem[]> {
    return this.items.filter(i =>
      pairs.some(p => p.serialNumber.equals(i.serialNumber) && p.variantId.equals(i.variantId))
    );
  }

  async findBySerialAndVariant(serialNumber: SerialNumber, variantId: ProductVariantId): Promise<SerializedItem | null> {
    return this.items.find(i => i.serialNumber.equals(serialNumber) && i.variantId.equals(variantId)) || null;
  }

  async findManyBySerialsAndVariant(serialNumbers: SerialNumber[], variantId: ProductVariantId): Promise<SerializedItem[]> {
    return this.items.filter(i => serialNumbers.some(sn => sn.equals(i.serialNumber)) && i.variantId.equals(variantId));
  }

  async findByVariantId(variantId: ProductVariantId, tenantId: TenantId): Promise<SerializedItem[]> {
    return this.items.filter(i => i.variantId.equals(variantId) && i.tenantId.equals(tenantId));
  }

  async countAllStatuses(variantId: ProductVariantId): Promise<Record<SerializedItemStatus, number>> {
    const result = {} as Record<SerializedItemStatus, number>;
    for (const status of Object.values(SerializedItemStatus)) {
      result[status] = this.items.filter(i => i.variantId.equals(variantId) && i.status === status).length;
    }
    return result;
  }
}
