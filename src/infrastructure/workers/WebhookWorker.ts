import { prisma, getTenantPrisma, globalPrisma } from '../persistence/prismaClient';
import { ProcessShopifyOrder } from '../../application/integrations/shopify/ProcessShopifyOrder';
import { SyncProductFromShopify } from '../../application/integrations/shopify/SyncProductFromShopify';
import {
  integrationRepository,
  externalMappingRepository,
  productRepository,
  inventoryService
} from '../graphql/resolvers';

const processShopifyOrderUseCase = new ProcessShopifyOrder(
  integrationRepository,
  externalMappingRepository,
  inventoryService
);

const syncProductFromShopifyUseCase = new SyncProductFromShopify(
  productRepository,
  externalMappingRepository
);

export class WebhookWorker {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  public static start(intervalMs = 5000) {
    if (this.timer) return;
    this.timer = setInterval(() => this.processPendingEvents(), intervalMs);
    console.log(`[WebhookWorker] Started background worker (polling every ${intervalMs}ms)`);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[WebhookWorker] Stopped background worker');
  }

  public static async processPendingEvents() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const events = await prisma.webhookEvent.findMany({
        where: { status: 'Pending' },
        orderBy: { occurredAt: 'asc' },
        take: 10,
      });

      if (events.length === 0) {
        return;
      }

      // Mark all as Processing in a single query
      await prisma.webhookEvent.updateMany({
        where: { id: { in: events.map((e: any) => e.id) } },
        data: { status: 'Processing' },
      });

      for (const event of events) {
        try {
          const connection = await integrationRepository.findByStoreDomain(event.shopDomain);
          if (!connection || !connection.isActive) {
            throw new Error(`No active connection found for shop: ${event.shopDomain}`);
          }

          const tenantId = connection.tenantId.value;
          const tenantPrisma = getTenantPrisma(globalPrisma, tenantId);

          await tenantPrisma.$transaction(async () => {
            const payload = JSON.parse(event.payload);

            if (event.topic === 'orders/create' || event.topic === 'orders/paid') {
              const lineItems = (payload.line_items || []).map((item: any) => ({
                shopifyVariantId: String(item.variant_id),
                quantity: Number(item.quantity),
              }));
              const shopifyLocationId = String(payload.location_id || 'default-shopify-location');

              await processShopifyOrderUseCase.execute({
                integrationId: connection.id.value,
                shopifyOrderId: String(payload.id),
                shopifyLocationId,
                lineItems,
              });
            } else if (event.topic === 'products/create' || event.topic === 'products/update') {
              const variants = (payload.variants || []).map((v: any) => ({
                id: String(v.id),
                sku: String(v.sku || ''),
                inventoryItemId: String(v.inventory_item_id || ''),
                title: String(v.title || ''),
              }));

              await syncProductFromShopifyUseCase.execute(
                connection.id.value,
                connection.tenantId.value,
                {
                  id: String(payload.id),
                  title: String(payload.title),
                  variants,
                }
              );
            }
          });

          // Mark as Processed
          await prisma.webhookEvent.update({
            where: { id: event.id },
            data: { status: 'Processed', attempts: event.attempts + 1 },
          });
          console.log(`[WebhookWorker] Successfully processed event ${event.id} (topic: ${event.topic})`);
        } catch (err: any) {
          console.error(`[WebhookWorker] Failed to process event ${event.id}:`, err);
          await prisma.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: event.attempts >= 3 ? 'Failed' : 'Pending',
              attempts: event.attempts + 1,
              lastError: err.message,
            },
          });
        }
      }
    } catch (error) {
      console.error('[WebhookWorker] Error in background worker loop:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
