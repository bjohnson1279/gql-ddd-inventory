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

      // 3. Batch upsert present variants and attributes
      if (product.variants.length > 0) {
        const variantIds = product.variants.map((v) => v.id.value);

        const existingVariants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true },
        });

        const existingIds = new Set<string>();
        for (const v of existingVariants) {
          existingIds.add(v.id);
        }

        const variantsToCreate: any[] = [];
        const variantsToUpdate: ProductVariant[] = [];

        for (const variant of product.variants) {
          if (!existingIds.has(variant.id.value)) {
            variantsToCreate.push({
              id: variant.id.value,
              productId: product.id.value,
              sku: variant.sku.value,
              trackingMode: variant.trackingMode,
              costingMethod: variant.costingMethod,
              weightGrams: variant.weightGrams,
              volumeCubicMeters: variant.volumeCubicMeters,
            });
          } else {
            variantsToUpdate.push(variant);
          }
        }

        if (variantsToCreate.length > 0) {
          await tx.productVariant.createMany({
            data: variantsToCreate,
          });
        }

        if (variantsToUpdate.length > 0) {
          const updateRows = variantsToUpdate.map(
            (variant) =>
              Prisma.sql`(${variant.id.value}::uuid, ${product.id.value}::uuid, ${variant.sku.value}::text, ${variant.trackingMode}::text, ${variant.costingMethod}::text, ${variant.weightGrams}::int, ${variant.volumeCubicMeters}::float8)`
          );

          await tx.$executeRaw`
            UPDATE product_variants AS t
            SET
              product_id = v.product_id::uuid,
              sku = v.sku::text,
              tracking_mode = v.tracking_mode::text,
              costing_method = v.costing_method::text,
              weight_grams = v.weight_grams::int,
              volume_cubic_meters = v.volume_cubic_meters::float8
            FROM (
              VALUES
                ${Prisma.join(updateRows)}
            ) AS v(id, product_id, sku, tracking_mode, costing_method, weight_grams, volume_cubic_meters)
            WHERE t.id = v.id::uuid;
          `;
        }

        // Recreate attributes in batch
        await tx.variantAttribute.deleteMany({
          where: { variantId: { in: variantIds } },
        });

        const allAttributes = product.variants.flatMap((variant) =>
          variant.attributes.all().map((attr) => ({
            variantId: variant.id.value,
            name: attr.name,
            value: attr.value,
          }))
        );

        if (allAttributes.length > 0) {
          await tx.variantAttribute.createMany({
            data: allAttributes,
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
    const uniqueProductIds = new Set<string>();
    for (const v of variants) {
      uniqueProductIds.add(v.productId);
    }
    const productIds = Array.from(uniqueProductIds);
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
