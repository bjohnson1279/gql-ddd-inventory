import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class InMemoryLedgerRepository implements ILedgerRepository {
  private entries: LedgerEntry[] = [];

  async append(entry: LedgerEntry): Promise<void> {
    this.entries.push(entry);
  }

  async currentQuantity(variantId: ProductVariantId, locationId: LocationId): Promise<number> {
    return this.entries
      .filter(e => e.variantId.equals(variantId) && e.locationId.equals(locationId))
      .reduce((sum, e) => sum + e.quantity, 0);
  }

  async entriesFor(variantId: ProductVariantId, locationId: LocationId): Promise<LedgerEntry[]> {
    return this.entries.filter(e => e.variantId.equals(variantId) && e.locationId.equals(locationId));
  }

  async hasAnyEntries(variantId: ProductVariantId, locationId: LocationId): Promise<boolean> {
    return this.entries.some(e => e.variantId.equals(variantId) && e.locationId.equals(locationId));
  }
}
