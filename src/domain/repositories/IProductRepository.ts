import { Product } from '../entities/Product';
import { ProductId } from '../valueObjects/ProductId';
import { Sku } from '../valueObjects/Sku';

export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findByIds(ids: ProductId[]): Promise<Product[]>;
  findBySku(sku: Sku): Promise<Product | null>;
  findBySkus(skus: Sku[]): Promise<Product[]>;
  findAll(): Promise<Product[]>;
}
