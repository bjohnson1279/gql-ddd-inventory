import { IQuarantineRepository } from '../../domain/repositories/IQuarantineRepository';
import { QuarantineItem } from '../../domain/entities/QuarantineItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';

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
    this.items.set(item.id, this.cloneItem(item));
  }

  async findById(id: string): Promise<QuarantineItem | null> {
    const record = this.items.get(id);
    return record ? this.cloneItem(record) : null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<QuarantineItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.tenantId.equals(tenantId))
      .map((i) => this.cloneItem(i));
  }
}
