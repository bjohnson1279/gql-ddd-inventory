import { prisma } from '../persistence/prismaClient';
import crypto from 'crypto';
import { validateOutboundUrl } from '../../utils/urlValidator';

export class WebhookDeliveryWorker {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  public static start(intervalMs = 2000) {
    if (this.timer) return;
    this.timer = setInterval(() => this.processPendingDeliveries(), intervalMs);
    console.log(`[WebhookDeliveryWorker] Started background worker (polling every ${intervalMs}ms)`);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[WebhookDeliveryWorker] Stopped background worker');
  }

  public static async processPendingDeliveries() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const deliveries = await prisma.webhookDelivery.findMany({
        where: {
          status: 'Pending',
          nextAttemptAt: {
            lte: new Date()
          }
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      if (deliveries.length === 0) return;

      const deliveryIds = deliveries.map((d: any) => d.id);
      await prisma.webhookDelivery.updateMany({
        where: { id: { in: deliveryIds } },
        data: { status: 'Processing' },
      });

      for (const delivery of deliveries) {
        try {
          const subscription = await prisma.webhookSubscription.findUnique({
            where: { id: delivery.subscriptionId }
          });

          if (!subscription || !subscription.isActive) {
            throw new Error(`Subscription ${delivery.subscriptionId} not found or inactive`);
          }

          // SSRF Protection: Validate target URL
          try {
            validateOutboundUrl(subscription.targetUrl);
          } catch (e: any) {
            throw new Error(e.message || 'Invalid URL format');
          }

          // Calculate signature
          const hmac = crypto.createHmac('sha256', subscription.secret);
          const signature = hmac.update(delivery.payload).digest('hex');

          // Send POST request
          const response = await fetch(subscription.targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature-256': signature,
              'X-Webhook-Event': delivery.eventType
            },
            body: delivery.payload,
            redirect: 'error'
          });

          if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
          }

          // Mark as Success
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'Success',
              attempts: delivery.attempts + 1,
              processedAt: new Date()
            }
          });
          console.log(`[WebhookDeliveryWorker] Successfully delivered webhook ${delivery.id} to ${subscription.targetUrl}`);
        } catch (err: any) {
          const nextAttempts = delivery.attempts + 1;
          const backoffMs = Math.min(Math.pow(2, nextAttempts) * 1000, 24 * 60 * 60 * 1000);
          const nextAttemptAt = new Date(Date.now() + backoffMs);
          const nextStatus = nextAttempts >= 5 ? 'Failed' : 'Pending';

          console.error(`[WebhookDeliveryWorker] Failed to deliver webhook ${delivery.id}:`, err.message);

          // Get tenantId from subscription if available
          const subscription = await prisma.webhookSubscription.findUnique({
            where: { id: delivery.subscriptionId }
          });
          const tenantId = subscription ? subscription.tenantId : 'default-tenant';

          // Publish failed webhook event to subscribers
          try {
            const { pubsub } = require('../graphql/pubsub');
            pubsub.publish(`WEBHOOK_FAILED_${tenantId}`, {
              webhookDeliveryFailed: {
                id: delivery.id,
                targetUrl: subscription ? subscription.targetUrl : 'unknown',
                eventType: delivery.eventType,
                payload: delivery.payload,
                errorMessage: err.message,
                attemptCount: nextAttempts
              }
            });
          } catch (pubSubErr) {
            console.error('Failed to publish webhook failure to pubsub:', pubSubErr);
          }

          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: nextStatus,
              attempts: nextAttempts,
              lastError: err.message,
              nextAttemptAt
            }
          });
        }
      }
    } catch (error) {
      console.error('[WebhookDeliveryWorker] Error in background worker loop:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
