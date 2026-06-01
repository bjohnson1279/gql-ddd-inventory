import { IIntegrationRepository } from '../../../domain/integrations/repositories/IIntegrationRepository';
import { IExternalMappingRepository } from '../../../domain/integrations/repositories/IExternalMappingRepository';
import { InventoryService } from '../../../domain/services/InventoryService';
import { IntegrationId } from '../../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../domain/valueObjects/TenantId';
import { LocationId } from '../../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../domain/valueObjects/ProductVariantId';
import { ExternalEntityType } from '../../../domain/integrations/enums/IntegrationEnums';
import { ActorId } from '../../../domain/valueObjects/ActorId';

export interface ShopifyOrderLineItem {
  shopifyVariantId: string;
  quantity: number;
}

export interface ShopifyOrderInput {
  integrationId: string;
  shopifyOrderId: string;
  lineItems: ShopifyOrderLineItem[];
  shopifyLocationId: string;
}

export class ProcessShopifyOrder {
  constructor(
    private readonly integrationRepo: IIntegrationRepository,
    private readonly mappingRepo: IExternalMappingRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(input: ShopifyOrderInput): Promise<void> {
    const integrationId = new IntegrationId(input.integrationId);
    const connection = await this.integrationRepo.findById(integrationId);

    if (!connection || !connection.isActive) {
      throw new Error(`Integration connection ${input.integrationId} not found or inactive.`);
    }

    const tenantId = connection.tenantId;

    // 1. Map Shopify location to our location
    const locationMapping = await this.mappingRepo.findByExternalId(
      integrationId,
      input.shopifyLocationId,
      ExternalEntityType.Location
    );

    if (!locationMapping) {
      throw new Error(`No mapping found for Shopify location ${input.shopifyLocationId}`);
    }

    const internalLocationId = new LocationId(locationMapping.internalId);

    // 2. Process each line item
    for (const item of input.lineItems) {
      const variantMapping = await this.mappingRepo.findByExternalId(
        integrationId,
        item.shopifyVariantId,
        ExternalEntityType.Variant
      );

      if (!variantMapping) {
        console.warn(`No mapping found for Shopify variant ${item.shopifyVariantId}. Skipping.`);
        continue;
      }

      const internalVariantId = new ProductVariantId(variantMapping.internalId);

      // 3. Decrement inventory using the core domain service
      await this.inventoryService.decrementForSale(
        tenantId,
        internalLocationId,
        internalVariantId,
        item.quantity,
        `SHOPIFY-${input.shopifyOrderId}`,
        new ActorId('shopify-integration')
      );
    }
  }
}
