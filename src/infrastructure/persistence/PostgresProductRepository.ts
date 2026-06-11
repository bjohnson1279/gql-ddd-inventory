import { PrismaClient, Prisma } from '@prisma/client';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product } from '../../domain/entities/Product';
import { ProductId } from '../../domain/valueObjects/ProductId';
import { ProductVariant } from '../../domain/entities/ProductVariant';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { Sku } from '../../domain/valueObjects/Sku';
import { VariantAttribute } from '../../domain/valueObjects/VariantAttribute';
import { VariantAttributeSet } from '../../domain/valueObjects/VariantAttributeSet';
import { VariantTrackingMode } from '../../domain/enums/VariantEnums';
import { CostingMethod } from '../../domain/enums/AccountingEnums';

type ProductModel = Prisma.ProductGetPayload<{
  include: {
    variants: {
      include: {
        attributes: true;
      };
    };
  };
}>;

export class PostgresProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Maps a Prisma ProductModel to a domain Product entity.
   * Note: The model parameter is strongly typed as ProductModel rather than any to ensure type safety.
   */
  private toDomain(model: ProductModel): Product {
    const variantsMap = new Map<string, ProductVariant>();

    for (const v of model.variants || []) {
      const attributes = (v.attributes || []).map(
        (a) => new VariantAttribute(a.name, a.value)
      );

      const variant = new ProductVariant(
        new ProductVariantId(v.id),
        new ProductId(model.id),
        new Sku(v.sku),
        new VariantAttributeSet(attributes),
        v.trackingMode as VariantTrackingMode,
        v.weightGrams || 0,
        v.volumeCubicMeters || 0,
        v.costingMethod as CostingMethod
      );
      variantsMap.set(variant.id.value, variant);
    }

    const product = new Product(new ProductId(model.id), model.name);
    (product as unknown as { _variants: Map<string, ProductVariant> })._variants = variantsMap;
    return product;
  }

  async save(product: Product): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert product
      await tx.product.upsert({
        where: { id: product.id.value },
        create: {
          id: product.id.value,
          name: product.name,
        },
        update: {
          name: product.name,
        },
      });

      // 2. Identify variants to keep
      const variantIds = product.variants.map((v) => v.id.value);

      // Delete attributes of variants that are being deleted
      await tx.variantAttribute.deleteMany({
        where: {
          variant: {
            productId: product.id.value,
            id: { notIn: variantIds },
          },
        },
      });

      // Delete variants not present anymore
      await tx.productVariant.deleteMany({
        where: {
          productId: product.id.value,
          id: { notIn: variantIds },
        },
      });

      // 3. Upsert present variants and attributes
      for (const variant of product.variants) {
        await tx.productVariant.upsert({
          where: { id: variant.id.value },
          create: {
            id: variant.id.value,
            productId: product.id.value,
            sku: variant.sku.value,
            trackingMode: variant.trackingMode,
            costingMethod: variant.costingMethod,
            weightGrams: variant.weightGrams,
            volumeCubicMeters: variant.volumeCubicMeters,
          },
          update: {
            sku: variant.sku.value,
            trackingMode: variant.trackingMode,
            costingMethod: variant.costingMethod,
            weightGrams: variant.weightGrams,
            volumeCubicMeters: variant.volumeCubicMeters,
          },
        });

        // Recreate attributes
        await tx.variantAttribute.deleteMany({
          where: { variantId: variant.id.value },
        });

        if (variant.attributes.all().length > 0) {
          await tx.variantAttribute.createMany({
            data: variant.attributes.all().map((attr) => ({
              variantId: variant.id.value,
              name: attr.name,
              value: attr.value,
            })),
          });
        }
      }
    });
  }

  async findById(id: ProductId): Promise<Product | null> {
    const model = await this.prisma.product.findUnique({
      where: { id: id.value },
      include: {
        variants: {
          include: {
            attributes: true,
          },
        },
      },
    });

    if (!model) return null;
    return this.toDomain(model);
  }

  async findByIds(ids: ProductId[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const models = await this.prisma.product.findMany({
      where: { id: { in: ids.map(id => id.value) } },
      include: {
        variants: {
          include: {
            attributes: true,
          },
        },
      },
    });
    return models.map(model => this.toDomain(model));
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    const variantModel = await this.prisma.productVariant.findUnique({
      where: { sku: sku.value },
      select: { productId: true },
    });

    if (!variantModel) return null;

    return this.findById(new ProductId(variantModel.productId));
  }

  async findBySkus(skus: Sku[]): Promise<Product[]> {
    if (skus.length === 0) return [];
    const skuStrs = skus.map(s => s.value);
    const variants = await this.prisma.productVariant.findMany({
      where: { sku: { in: skuStrs } },
      select: { productId: true },
    });
    const productIds = Array.from(new Set(variants.map(v => v.productId)));
    return this.findByIds(productIds.map(id => new ProductId(id)));
  }

  async findSkuByVariantId(variantId: string): Promise<string | null> {
    const variantModel = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { sku: true },
    });
    return variantModel ? variantModel.sku : null;
  }

  async findSkusByVariantIds(variantIds: string[]): Promise<Map<string, string>> {
    const variantModels = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true },
    });
    const map = new Map<string, string>();
    for (const v of variantModels) {
      map.set(v.id, v.sku);
    }
    return map;
  }

  async findAll(): Promise<Product[]> {
    const models = await this.prisma.product.findMany({
      include: {
        variants: {
          include: {
            attributes: true,
          },
        },
      },
    });

    return models.map((m) => this.toDomain(m));
  }
}
