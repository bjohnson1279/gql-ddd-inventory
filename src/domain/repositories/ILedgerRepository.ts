import { LedgerEntry } from '../entities/LedgerEntry';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { LocationId } from '../valueObjects/LocationId';

export interface ILedgerRepository {
  append(entry: LedgerEntry): Promise<void>;
  appendBatch(entries: LedgerEntry[]): Promise<void>;
  currentQuantity(variantId: ProductVariantId, locationId: LocationId): Promise<number>;
  currentQuantities(variantIds: ProductVariantId[], locationId: LocationId): Promise<Map<string, number>>;
  entriesFor(variantId: ProductVariantId, locationId?: LocationId): Promise<LedgerEntry[]>;
  entriesForBatch(variantIds: ProductVariantId[], locationId?: LocationId): Promise<Map<string, LedgerEntry[]>>;
  findRecallEntries(lotNumber: string): Promise<LedgerEntry[]>;
  currentQuantityAt(variantId: ProductVariantId, locationId: LocationId, timestamp: Date): Promise<number>;
  hasAnyEntries(variantId: ProductVariantId, locationId: LocationId): Promise<boolean>;
  hasAnyEntriesBatch(variantIds: ProductVariantId[], locationId: LocationId): Promise<Map<string, boolean>>;
}
