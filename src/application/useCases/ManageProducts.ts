import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { ProductId } from '../../domain/valueObjects/ProductId';
import { Sku } from '../../domain/valueObjects/Sku';
import { VariantAttribute } from '../../domain/valueObjects/VariantAttribute';
import { VariantTrackingMode } from '../../domain/enums/VariantEnums';

export class CreateProductUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(id: string, name: string): Promise<boolean> {
    const product = new Product(new ProductId(id), name);
    await this.productRepo.save(product);
    return true;
  }
}

export interface AddVariantInput {
  productId: string;
  sku: string;
  attributes: { name: string; value: string }[];
  trackingMode: VariantTrackingMode;
}

export class AddProductVariantUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(input: AddVariantInput): Promise<boolean> {
    const product = await this.productRepo.findById(new ProductId(input.productId));
    if (!product) {
      throw new Error(`Product ${input.productId} not found.`);
    }

    const attrs = input.attributes.map((a) => new VariantAttribute(a.name, a.value));
    const variant = product.addVariant(new Sku(input.sku), attrs, input.trackingMode);

    await this.productRepo.save(product);
    return true;
  }
}

export class GetProductsUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(): Promise<Product[]> {
    return await this.productRepo.findAll();
  }
}

export class GetProductByIdUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(id: string): Promise<Product | null> {
    return await this.productRepo.findById(new ProductId(id));
  }
}
