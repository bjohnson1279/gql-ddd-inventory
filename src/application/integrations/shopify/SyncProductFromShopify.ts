import { IProductRepository } from '../../../domain/repositories/IProductRepository';
import { IExternalMappingRepository } from '../../../domain/integrations/repositories/IExternalMappingRepository';
import { Product } from '../../../domain/entities/Product';
import { ProductId } from '../../../domain/valueObjects/ProductId';
import { Sku } from '../../../domain/valueObjects/Sku';
import { IntegrationId } from '../../../domain/integrations/valueObjects/IntegrationId';
import { ExternalMapping } from '../../../domain/integrations/entities/ExternalMapping';
import { ExternalEntityType } from '../../../domain/integrations/enums/IntegrationEnums';
import { TenantId } from '../../../domain/valueObjects/TenantId';
import { VariantAttribute } from '../../../domain/valueObjects/VariantAttribute';
import { ShopifyProductData, ShopifyVariantData } from '../../../domain/integrations/services/IShopifyClient';

export class SyncProductFromShopify {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly mappingRepo: IExternalMappingRepository
  ) {}

  async execute(integrationId: string, tenantId: string, data: ShopifyProductData): Promise<void> {
    const iId = new IntegrationId(integrationId);
    const tId = new TenantId(tenantId);

    // 1. Check if we have a mapping for this product
    const productMapping = await this.mappingRepo.findByExternalId(
      iId,
      data.id,
      ExternalEntityType.Product
    );

    let product: Product;

    if (productMapping) {
      const existingProduct = await this.productRepo.findById(new ProductId(productMapping.internalId));
      if (!existingProduct) throw new Error(`Product ${productMapping.internalId} not found but mapping exists.`);
      product = existingProduct;
      // Update product title if needed (ignoring for brevity)
    } else {
      // Create new product
      product = new Product(
        new ProductId(Math.random().toString(36).substring(2, 15)),
        data.title
      );
      await this.productRepo.save(product);
      await this.mappingRepo.save(new ExternalMapping(
        tId, iId, ExternalEntityType.Product, product.id.value, data.id
      ));
    }

    // 2. Sync variants
    const variantExternalIds = data.variants.map(v => v.id);
    const existingVariantMappings = await this.mappingRepo.findByExternalIds(
      iId,
      variantExternalIds,
      ExternalEntityType.Variant
    );
    const variantMappingMap = new Map(
      existingVariantMappings.map(m => [m.externalId, m])
    );

    for (const variantData of data.variants) {
      const variantMapping = variantMappingMap.get(variantData.id);

      if (!variantMapping) {
        // Create new variant
        const variant = product.addVariant(
          new Sku(variantData.sku),
          [new VariantAttribute('title', variantData.title)]
        );
        await this.productRepo.save(product);
        await this.mappingRepo.save(new ExternalMapping(
          tId,
          iId,
          ExternalEntityType.Variant,
          variant.id.value,
          variantData.id,
          variantData.inventoryItemId
        ));
      } else {
        // Variant already exists, maybe update SKU (ignoring for brevity)
      }
    }
  }
}
