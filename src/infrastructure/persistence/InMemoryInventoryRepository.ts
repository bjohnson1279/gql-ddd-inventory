import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../domain/entities/InventoryItem';

export class InMemoryInventoryRepository implements IInventoryRepository {
  private readonly items: Map<string, InventoryItem> = new Map();

  async findById(id: string): Promise<InventoryItem | null> {
    return this.items.get(id) || null;
  }

  async findBySku(sku: string): Promise<InventoryItem | null> {
    for (const item of this.items.values()) {
      if (item.sku.value === sku) {
        return item;
      }
    }
    return null;
  }

  async save(item: InventoryItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values());
  }
}
