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

  async findByIds(ids: ProductId[]): Promise<Product[]> {
    const results: Product[] = [];
    for (const id of ids) {
      const product = this.products.get(id.value);
      if (product) results.push(product);
    }
    return results;
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    for (const product of this.products.values()) {
      if (product.variants.some(v => v.sku.equals(sku))) {
        return product;
      }
    }
    return null;
  }

  async findBySkus(skus: Sku[]): Promise<Product[]> {
    const results: Product[] = [];
    for (const sku of skus) {
      for (const product of this.products.values()) {
        if (product.variants.some(v => v.sku.equals(sku))) {
          if (!results.includes(product)) {
            results.push(product);
          }
        }
      }
    }
    return results;
  }

  async findAll(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
}
