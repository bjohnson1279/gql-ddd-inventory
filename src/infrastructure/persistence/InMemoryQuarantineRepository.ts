import { IQuarantineRepository } from '../../domain/repositories/IQuarantineRepository';
import { QuarantineItem } from '../../domain/entities/QuarantineItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { QuarantineItemId } from '../../domain/valueObjects/QuarantineItemId';

export class InMemoryQuarantineRepository implements IQuarantineRepository {
  private readonly items: Map<string, QuarantineItem> = new Map();

  private cloneItem(item: QuarantineItem): QuarantineItem {
    return new QuarantineItem(
      item.id,
      item.variantId,
      item.quantity,
      item.reason,
      new LocationId(item.locationId.value),
      new TenantId(item.tenantId.value),
      item.status,
      item.createdAt,
      item.resolvedAt
    );
  }

  async save(item: QuarantineItem): Promise<void> {
    this.items.set(item.id.value, this.cloneItem(item));
  }

  async saveBatch(items: QuarantineItem[]): Promise<void> {
    for (const item of items) {
      await this.save(item);
    }
  }

  async findById(id: QuarantineItemId | string): Promise<QuarantineItem | null> {
    const key = typeof id === 'string' ? id : id.value;
    const record = this.items.get(key);
    return record ? this.cloneItem(record) : null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<QuarantineItem[]> {
    const results: QuarantineItem[] = [];
    for (const item of this.items.values()) {
      if (item.tenantId.equals(tenantId)) {
        results.push(this.cloneItem(item));
      }
    }
    return results;
  }
}
