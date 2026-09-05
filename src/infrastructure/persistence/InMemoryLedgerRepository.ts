import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class InMemoryLedgerRepository implements ILedgerRepository {
  private entries: LedgerEntry[] = [];

  async append(entry: LedgerEntry): Promise<void> {
    this.entries.push(entry);
  }

  async appendBatch(entries: LedgerEntry[]): Promise<void> {
    this.entries.push(...entries);
  }

  async currentQuantity(variantId: ProductVariantId, locationId: LocationId): Promise<number> {
    let sum = 0;
    // ⚡ Bolt: Single pass for loop avoids intermediate array allocations from filter/reduce
    for (const e of this.entries) {
      if (e.variantId.equals(variantId) && e.locationId.equals(locationId)) {
        sum += e.quantity;
      }
    }
    return sum;
  }

  async currentQuantityAt(variantId: ProductVariantId, locationId: LocationId, timestamp: Date): Promise<number> {
    let sum = 0;
    // ⚡ Bolt: Single pass for loop avoids intermediate array allocations from filter/reduce
    for (const e of this.entries) {
      if (e.variantId.equals(variantId) && e.locationId.equals(locationId) && e.occurredAt <= timestamp) {
        sum += e.quantity;
      }
    }
    return sum;
  }

  async currentQuantities(variantIds: ProductVariantId[], locationId: LocationId): Promise<Map<string, number>> {
    const quantities = new Map<string, number>();
    const variantIdStrs = new Set(variantIds.map(id => id.value));

    for (const entry of this.entries) {
      if (entry.locationId.equals(locationId) && variantIdStrs.has(entry.variantId.value)) {
        const current = quantities.get(entry.variantId.value) || 0;
        quantities.set(entry.variantId.value, current + entry.quantity);
      }
    }

    return quantities;
  }

  async entriesFor(variantId: ProductVariantId, locationId?: LocationId): Promise<LedgerEntry[]> {
    return this.entries.filter(
      (e) =>
        e.variantId.equals(variantId) &&
        (!locationId || e.locationId.equals(locationId))
    );
  }

  async entriesForBatch(variantIds: ProductVariantId[], locationId?: LocationId): Promise<Map<string, LedgerEntry[]>> {
    const variantIdStrs = new Set(variantIds.map(id => id.value));
    const map = new Map<string, LedgerEntry[]>();

    for (const e of this.entries) {
      if (
        variantIdStrs.has(e.variantId.value) &&
        (!locationId || e.locationId.equals(locationId))
      ) {
        const list = map.get(e.variantId.value) || [];
        list.push(e);
        map.set(e.variantId.value, list);
      }
    }
    return map;
  }

  async findRecallEntries(lotNumber: string): Promise<LedgerEntry[]> {
    return this.entries.filter((e) => e.metadata?.lotNumber === lotNumber);
  }

  async hasAnyEntries(variantId: ProductVariantId, locationId: LocationId): Promise<boolean> {
    return this.entries.some(e => e.variantId.equals(variantId) && e.locationId.equals(locationId));
  }

  async hasAnyEntriesBatch(variantIds: ProductVariantId[], locationId: LocationId): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    const variantIdStrs = new Set(variantIds.map(id => id.value));

    for (const id of variantIds) {
      result.set(id.value, false);
    }

    for (const entry of this.entries) {
      if (entry.locationId.equals(locationId) && variantIdStrs.has(entry.variantId.value)) {
        result.set(entry.variantId.value, true);
      }
    }

    return result;
  }
}
