import { IRmaRepository } from '../../domain/repositories/IRmaRepository';
import { Rma } from '../../domain/entities/Rma';
import { RmaItem } from '../../domain/entities/RmaItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class InMemoryRmaRepository implements IRmaRepository {
  private readonly rmas: Map<string, Rma> = new Map();

  private cloneRma(rma: Rma): Rma {
    const items = rma.items.map(
      (item) =>
        new RmaItem(
          item.id,
          item.variantId,
          item.quantity,
          item.unitCostCents,
          item.receivedQuantity,
          item.status,
          item.disposition
        )
    );

    return new Rma(
      rma.id,
      rma.rmaNumber,
      new TenantId(rma.tenantId.value),
      rma.customerId,
      new LocationId(rma.locationId.value),
      rma.status,
      items,
      rma.createdAt,
      rma.updatedAt
    );
  }

  async save(rma: Rma): Promise<void> {
    this.rmas.set(rma.id, this.cloneRma(rma));
  }

  async findById(id: string): Promise<Rma | null> {
    const record = this.rmas.get(id);
    return record ? this.cloneRma(record) : null;
  }

  async findByNumber(rmaNumber: string): Promise<Rma | null> {
    for (const r of this.rmas.values()) {
      if (r.rmaNumber === rmaNumber) {
        return this.cloneRma(r);
      }
    }
    return null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<Rma[]> {
    const results: Rma[] = [];
    for (const r of this.rmas.values()) {
      if (r.tenantId.equals(tenantId)) {
        results.push(this.cloneRma(r));
      }
    }
    return results;
  }
}
