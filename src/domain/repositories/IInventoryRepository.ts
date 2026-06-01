import { InventoryItem } from '../entities/InventoryItem';

export interface IInventoryRepository {
  findById(id: string): Promise<InventoryItem | null>;
  findBySku(sku: string): Promise<InventoryItem[]>;
  findBySkuAndLocation(sku: string, locationId: string): Promise<InventoryItem | null>;
  findBySkusAndLocations(pairs: { sku: string; locationId: string }[]): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  saveBatch(items: InventoryItem[]): Promise<void>;
  findAll(): Promise<InventoryItem[]>;
}
