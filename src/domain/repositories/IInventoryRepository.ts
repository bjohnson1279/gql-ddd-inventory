import { InventoryItem } from '../entities/InventoryItem';

export interface IInventoryRepository {
  findById(id: string): Promise<InventoryItem | null>;
  findBySku(sku: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
  findAll(): Promise<InventoryItem[]>;
}
