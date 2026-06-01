import { Kit } from '../entities/Kit';
import { KitId } from '../valueObjects/KitId';
import { Sku } from '../valueObjects/Sku';

export interface IKitRepository {
  save(kit: Kit): Promise<void>;
  findById(id: KitId): Promise<Kit | null>;
  findByIds(ids: KitId[]): Promise<Kit[]>;
  findBySku(sku: Sku): Promise<Kit | null>;
  findBySkus(skus: Sku[]): Promise<Kit[]>;
  delete(id: KitId): Promise<void>;
}
