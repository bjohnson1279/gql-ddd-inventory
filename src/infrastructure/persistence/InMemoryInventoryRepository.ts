import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { ConcurrencyError } from '../../domain/exceptions/DomainErrors';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { Quantity } from '../../domain/valueObjects/Quantity';

export class InMemoryInventoryRepository implements IInventoryRepository {
  private readonly items: Map<string, InventoryItem> = new Map();

  private cloneItem(item: InventoryItem): InventoryItem {
    return new InventoryItem(
      item.id,
      new Sku(item.sku.value),
      new LocationId(item.locationId.value),
      new Quantity(item.quantity.value),
      new Quantity(item.allocated.value),
      new Quantity(item.inTransit.value),
      item.version
    );
  }

  async findById(id: string): Promise<InventoryItem | null> {
    const item = this.items.get(id);
    return item ? this.cloneItem(item) : null;
  }

  async findBySku(sku: string): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    for (const item of this.items.values()) {
      if (item.sku.value === sku) {
        results.push(this.cloneItem(item));
      }
    }
    return results;
  }

  async findBySkuAndLocation(sku: string, locationId: string): Promise<InventoryItem | null> {
    for (const item of this.items.values()) {
      if (item.sku.value === sku && item.locationId.value === locationId) {
        return this.cloneItem(item);
      }
    }
    return null;
  }

  async findBySkuAndLocationBatch(pairs: { sku: string; locationId: string }[]): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    const pairKeys = new Set<string>();
    for (const p of pairs) {
      pairKeys.add(`${p.sku}|${p.locationId}`);
    }

    for (const item of this.items.values()) {
      if (pairKeys.has(`${item.sku.value}|${item.locationId.value}`)) {
        results.push(this.cloneItem(item));
      }
    }
    return results;
  }

  async save(item: InventoryItem): Promise<void> {
    const existing = this.items.get(item.id);
    
    // Optimistic Concurrency Control Check
    if (existing && existing.version !== item.version - 1) {
      throw new ConcurrencyError(item.sku.value, item.locationId.value);
    }
    
    this.items.set(item.id, item);
  }

  async saveBatch(items: InventoryItem[]): Promise<void> {
    for (const item of items) {
      await this.save(item);
    }
  }

  async findByLocation(locationId: string): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    for (const item of this.items.values()) {
      if (item.locationId.value === locationId) {
        results.push(this.cloneItem(item));
      }
    }
    return results;
  }

  async findByLocationsBatch(locationIds: string[]): Promise<InventoryItem[]> {
    const locationSet = new Set(locationIds);
    const results: InventoryItem[] = [];
    for (const item of this.items.values()) {
      if (locationSet.has(item.locationId.value)) {
        results.push(this.cloneItem(item));
      }
    }
    return results;
  }

  async findAll(): Promise<InventoryItem[]> {
    // ⚡ Bolt: Removed Array.from().map() to avoid intermediate array allocation
    const results: InventoryItem[] = [];
    for (const item of this.items.values()) {
      results.push(this.cloneItem(item));
    }
    return results;
  }
}
