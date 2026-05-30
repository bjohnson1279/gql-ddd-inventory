import { Kit } from '../entities/Kit';
import { KitId } from '../valueObjects/KitId';
import { Sku } from '../valueObjects/Sku';

export interface IKitRepository {
  save(kit: Kit): Promise<void>;
  findById(id: KitId): Promise<Kit | null>;
  findBySku(sku: Sku): Promise<Kit | null>;
  delete(id: KitId): Promise<void>;
}
