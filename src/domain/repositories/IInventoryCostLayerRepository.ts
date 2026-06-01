import { InventoryCostLayer } from '../entities/InventoryCostLayer';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerialNumber } from '../valueObjects/SerialNumber';

export interface IInventoryCostLayerRepository {
  save(layer: InventoryCostLayer): Promise<void>;
  saveBatch(layers: InventoryCostLayer[]): Promise<void>;
  getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]>;
  findBySerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<InventoryCostLayer | null>;
}
