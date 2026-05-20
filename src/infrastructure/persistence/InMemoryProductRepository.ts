import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { ProductId } from '../../domain/valueObjects/ProductId';
import { Sku } from '../../domain/valueObjects/Sku';

export class InMemoryProductRepository implements IProductRepository {
  private products: Map<string, Product> = new Map();

  async save(product: Product): Promise<void> {
    this.products.set(product.id.value, product);
  }

  async findById(id: ProductId): Promise<Product | null> {
    return this.products.get(id.value) || null;
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    for (const product of this.products.values()) {
      if (product.variants.some(v => v.sku.equals(sku))) {
        return product;
      }
    }
    return null;
  }

  async findAll(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
}
