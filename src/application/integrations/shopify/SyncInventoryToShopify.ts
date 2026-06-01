import { IIntegrationRepository } from '../../../domain/integrations/repositories/IIntegrationRepository';
import { IExternalMappingRepository } from '../../../domain/integrations/repositories/IExternalMappingRepository';
import { ILedgerRepository } from '../../../domain/repositories/ILedgerRepository';
import { IShopifyClient } from '../../../domain/integrations/services/IShopifyClient';
import { TenantId } from '../../../domain/valueObjects/TenantId';
import { LocationId } from '../../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../domain/valueObjects/ProductVariantId';
import { ExternalEntityType, IntegrationPlatform } from '../../../domain/integrations/enums/IntegrationEnums';

export class SyncInventoryToShopify {
  constructor(
    private readonly integrationRepo: IIntegrationRepository,
    private readonly mappingRepo: IExternalMappingRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly shopifyClient: IShopifyClient
  ) {}

  async execute(tenantId: string, locationId: string, variantId: string): Promise<void> {
    const tId = new TenantId(tenantId);
    const lId = new LocationId(locationId);
    const vId = new ProductVariantId(variantId);

    // 1. Get all active Shopify connections for this tenant
    const connections = await this.integrationRepo.findAllByTenant(tId);
    const activeShopifyConnections = connections.filter(
      c => c.platform === IntegrationPlatform.Shopify && c.isActive
    );

    if (activeShopifyConnections.length === 0) return;

    // 2. Get current stock level from ledger
    const currentQty = await this.ledgerRepo.currentQuantity(vId, lId);

    // 3. For each connection, find the mapping and push to Shopify
    await Promise.all(
      activeShopifyConnections.map(async (connection) => {
        const [variantMapping, locationMapping] = await Promise.all([
          this.mappingRepo.findByInternalId(
            connection.id,
            vId.value,
            ExternalEntityType.Variant
          ),
          this.mappingRepo.findByInternalId(
            connection.id,
            lId.value,
            ExternalEntityType.Location
          )
        ]);

        if (variantMapping && locationMapping && variantMapping.externalSecondaryId) {
          await this.shopifyClient.setInventory(
            connection.storeDomain,
            connection.accessToken,
            variantMapping.externalSecondaryId, // inventoryItemId
            locationMapping.externalId,
            currentQty
          );
        }
      })
    );
  }
}
