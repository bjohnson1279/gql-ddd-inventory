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
    return Array.from(this.items.values())
      .filter(item => item.sku.value === sku)
      .map(item => this.cloneItem(item));
  }

  async findBySkuAndLocation(sku: string, locationId: string): Promise<InventoryItem | null> {
    const item = Array.from(this.items.values()).find(
      item => item.sku.value === sku && item.locationId.value === locationId
    );
    return item ? this.cloneItem(item) : null;
  }

  async findBySkuAndLocationBatch(pairs: { sku: string; locationId: string }[]): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    const allItems = Array.from(this.items.values());
    for (const pair of pairs) {
      const item = allItems.find(
        i => i.sku.value === pair.sku && i.locationId.value === pair.locationId
      );
      if (item) {
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
    return Array.from(this.items.values())
      .filter(item => item.locationId.value === locationId)
      .map(item => this.cloneItem(item));
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values()).map(item => this.cloneItem(item));
  }
}
