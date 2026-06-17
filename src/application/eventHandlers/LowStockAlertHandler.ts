import { LowStockAlertEvent } from '../../domain/events/InventoryEvents';
import { prisma } from '../../infrastructure/persistence/prismaClient';
import { pubsub } from '../../infrastructure/graphql/pubsub';
import * as crypto from 'crypto';

export class LowStockAlertHandler {
  async handle(event: LowStockAlertEvent): Promise<void> {
    console.log(`[LowStockAlertHandler] 🚨 ALERT: SKU ${event.sku} at location ${event.locationId} dropped to ${event.currentQuantity} items!`);

    try {
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: {
          variant: {
            sku: event.sku
          }
        }
      });
      const tenantId = ledgerEntry?.tenantId || 'tenant-1';

      const id = crypto.randomUUID();
      const title = 'Low Stock Alert';
      const message = `SKU ${event.sku} at location ${event.locationId} dropped to ${event.currentQuantity} items!`;
      const type = 'warning';

      await prisma.notification.create({
        data: {
          id,
          tenantId,
          title,
          message,
          type,
          isRead: false
        }
      });

      await pubsub.publish(`NOTIFICATION_CREATED_${tenantId}`, {
        notificationCreated: {
          id,
          tenantId,
          title,
          message,
          type,
          isRead: false,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('[LowStockAlertHandler] Failed to save/publish notification:', err);
    }
  }
}
