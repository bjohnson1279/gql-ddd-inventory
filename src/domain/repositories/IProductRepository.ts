import { Product } from '../entities/Product';
import { ProductId } from '../valueObjects/ProductId';
import { Sku } from '../valueObjects/Sku';

export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: Sku): Promise<Product | null>;
  findAll(): Promise<Product[]>;
}
