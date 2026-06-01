import { LedgerEntry } from '../entities/LedgerEntry';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { LocationId } from '../valueObjects/LocationId';

export interface ILedgerRepository {
  append(entry: LedgerEntry): Promise<void>;
  appendBatch?(entries: LedgerEntry[]): Promise<void>;
  currentQuantity(variantId: ProductVariantId, locationId: LocationId): Promise<number>;
  currentQuantities(variantIds: ProductVariantId[], locationId: LocationId): Promise<Map<string, number>>;
  entriesFor(variantId: ProductVariantId, locationId: LocationId): Promise<LedgerEntry[]>;
  hasAnyEntries(variantId: ProductVariantId, locationId: LocationId): Promise<boolean>;
}
