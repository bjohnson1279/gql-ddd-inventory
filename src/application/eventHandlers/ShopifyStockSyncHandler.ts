import { ShopifyStockSyncRequested } from '../../domain/events/InventoryEvents';
import { prisma } from '../../infrastructure/persistence/prismaClient';

export class ShopifyStockSyncHandler {
  async handle(event: ShopifyStockSyncRequested): Promise<void> {
    console.log(`[ShopifyStockSyncHandler] 🔄 Syncing SKU ${event.sku} stock level to Shopify...`);

    const variant = await prisma.productVariant.findUnique({
      where: { sku: event.sku }
    });

    const connections = await prisma.integrationConnection.findMany({
      where: { tenantId: event.tenantId, platform: 'Shopify', isActive: true }
    });

    if (!variant || connections.length === 0) {
      console.warn(`[ShopifyStockSyncHandler] No variant or active Shopify connection found for SKU ${event.sku}`);
      return;
    }

    const locMapping = await prisma.externalMapping.findFirst({
      where: { tenantId: event.tenantId, entityType: 'LOCATION', internalId: event.locationId }
    });

    if (!locMapping) {
      console.warn(`[ShopifyStockSyncHandler] No location mapping found for location ${event.locationId}`);
      return;
    }

    const ledgerSum = await prisma.ledgerEntry.aggregate({
      where: { tenantId: event.tenantId, variantId: variant.id, locationId: event.locationId },
      _sum: { quantity: true }
    });
    const localQty = ledgerSum._sum.quantity || 0;

    for (const conn of connections) {
      if (conn.accessToken && conn.accessToken !== 'mock-token' && !conn.storeDomain.includes('mock')) {
        const response = await fetch(
          `https://${conn.storeDomain}/admin/api/2024-04/graphql.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': conn.accessToken
            },
            body: JSON.stringify({
              query: `
                mutation setQty($input: InventorySetOnHandQuantitiesInput!) {
                  inventorySetOnHandQuantities(input: $input) {
                    userErrors { message }
                  }
                }
              `,
              variables: {
                input: {
                  setQuantities: [
                    {
                      inventoryItemId: event.externalRefId,
                      locationId: locMapping.externalId,
                      quantity: localQty
                    }
                  ]
                }
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Shopify API responded with status ${response.status}`);
        }

        const resData = (await response.json()) as any;
        const errors = resData?.data?.inventorySetOnHandQuantities?.userErrors || [];
        if (errors.length > 0) {
          throw new Error(`Shopify API error: ${errors.map((e: any) => e.message).join(', ')}`);
        }
      } else {
        console.log(`[ShopifyStockSyncHandler] [MOCK] Synced SKU ${event.sku} to Shopify. Qty: ${localQty}`);
      }
    }
  }
}
