import { InventoryCostLayer } from '../entities/InventoryCostLayer';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerialNumber } from '../valueObjects/SerialNumber';

export interface IInventoryCostLayerRepository {
  save(layer: InventoryCostLayer): Promise<void>;
  saveMany(layers: InventoryCostLayer[]): Promise<void>;
  getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]>;
  getActiveLayersBatch(variantIds: ProductVariantId[], orderBy?: string): Promise<Map<string, InventoryCostLayer[]>>;
  findBySerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<InventoryCostLayer | null>;
}
