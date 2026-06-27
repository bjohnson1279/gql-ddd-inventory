import { ProductUomConfiguration } from '../entities/ProductUomConfiguration';
import { Sku } from '../valueObjects/Sku';

export interface IProductUomConfigurationRepository {
  save(config: ProductUomConfiguration): Promise<void>;
  findBySku(sku: Sku): Promise<ProductUomConfiguration | null>;
  findById(id: string): Promise<ProductUomConfiguration | null>;
}
