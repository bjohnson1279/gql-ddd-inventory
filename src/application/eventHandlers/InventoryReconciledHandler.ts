import { InventoryReconciledEvent } from '../../domain/events/InventoryEvents';
import { prisma } from '../../infrastructure/persistence/prismaClient';
import { pubsub } from '../../infrastructure/graphql/pubsub';
import * as crypto from 'crypto';

export class InventoryReconciledHandler {
  async handle(event: InventoryReconciledEvent): Promise<void> {
    console.log(`[InventoryReconciledHandler] 📊 ACCOUNTING NOTIFIED: Variance of ${event.variance} recorded for SKU ${event.sku}.`);

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
      const title = 'Inventory Reconciled';
      const message = `Variance of ${event.variance} recorded for SKU ${event.sku}.`;
      const type = 'info';

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
      console.error('[InventoryReconciledHandler] Failed to save/publish notification:', err);
    }
  }
}
