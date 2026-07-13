import { prisma } from '../persistence/prismaClient';
import { eventBus } from '../graphql/resolvers';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { InventoryDecremented, LowStockAlertEvent, InventoryReconciledEvent, ShopifyStockSyncRequested } from '../../domain/events/InventoryEvents';
import { runWithTrace, generateTraceId } from '../telemetry/traceContext';

export function deserializeEvent(eventType: string, payloadStr: string): any {
  const payload = JSON.parse(payloadStr);

  if (eventType === 'InventoryDecremented') {
    const variantId = new ProductVariantId(payload.variantId.value);
    const event = new InventoryDecremented(
      payload.tenantId,
      payload.locationId,
      variantId,
      payload.quantity,
      payload.referenceId
    );
    (event as any).occurredAt = new Date(payload.occurredAt);
    return event;
  } else if (eventType === 'LowStockAlertEvent') {
    const event = new LowStockAlertEvent(
      payload.sku,
      payload.locationId,
      payload.currentQuantity
    );
    (event as any).occurredAt = new Date(payload.occurredAt);
    return event;
  } else if (eventType === 'InventoryReconciledEvent') {
    const event = new InventoryReconciledEvent(
      payload.sku,
      payload.locationId,
      payload.expected,
      payload.actual,
      payload.variance
    );
    (event as any).occurredAt = new Date(payload.occurredAt);
    return event;
  } else if (eventType === 'ShopifyStockSyncRequested') {
    const event = new ShopifyStockSyncRequested(
      payload.tenantId,
      payload.sku,
      payload.locationId,
      payload.externalRefId
    );
    (event as any).occurredAt = new Date(payload.occurredAt);
    return event;
  } else {
    // Dynamic fallback to preserve constructor.name matching eventType
    const mockConstructor = function () {};
    Object.defineProperty(mockConstructor, 'name', { value: eventType, writable: false });
    const event = Object.create(mockConstructor.prototype);
    for (const key of Object.keys(payload)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      event[key] = payload[key];
    }
    if (event.occurredAt) event.occurredAt = new Date(event.occurredAt);
    return event;
  }
}

export class OutboxWorker {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  public static start(intervalMs = 200) {
    if (this.timer) return;
    this.timer = setInterval(() => this.processPendingEvents(), intervalMs);
    console.log(`[OutboxWorker] Started background worker (polling every ${intervalMs}ms)`);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[OutboxWorker] Stopped background worker');
  }

  public static async processPendingEvents() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const events = await prisma.outboxEvent.findMany({
        where: {
          status: 'Pending',
          nextAttemptAt: {
            lte: new Date()
          }
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      if (events.length === 0) return;

      const eventIds = events.map((e: any) => e.id);
      await prisma.outboxEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { status: 'Processing' },
      });

      const processedIds: string[] = [];

      for (const event of events) {
        try {
          const domainEvent = deserializeEvent(event.eventType, event.payload);
          let traceId = 'unknown';
          try {
            const payloadObj = JSON.parse(event.payload);
            traceId = payloadObj?.traceId || generateTraceId();
          } catch (e) {
            traceId = generateTraceId();
          }

          await runWithTrace(traceId, async () => {
            // Publish event asynchronously to InMemoryEventBus
            eventBus.publish(domainEvent);
          });

          // Enqueue webhooks for active subscriptions matching tenant and event type
          let eventTenantId = 'tenant-1';
          try {
            const payloadObj = JSON.parse(event.payload);
            eventTenantId = payloadObj?.tenantId || (payloadObj?.tenantId && typeof payloadObj.tenantId === 'object' ? payloadObj.tenantId.value : payloadObj?.tenantId) || 'tenant-1';
          } catch (e) {}

          const subscriptions = await prisma.webhookSubscription.findMany({
            where: {
              tenantId: eventTenantId,
              isActive: true,
              eventTypes: {
                has: event.eventType
              }
            }
          });

          if (subscriptions.length > 0) {
            await Promise.all(subscriptions.map((sub: any) =>
              prisma.webhookDelivery.create({
                data: {
                  tenantId: eventTenantId,
                  subscriptionId: sub.id,
                  eventType: event.eventType,
                  payload: event.payload,
                  status: 'Pending',
                  attempts: 0,
                  nextAttemptAt: new Date()
                }
              })
            ));
          }

          processedIds.push(event.id);
        } catch (err: any) {
          let traceId = 'unknown';
          try {
            const payloadObj = JSON.parse(event.payload);
            traceId = payloadObj?.traceId || 'unknown';
          } catch (e) {}
          const nextAttempts = event.attempts + 1;
          const backoffMs = Math.min(Math.pow(2, nextAttempts) * 1000, 24 * 60 * 60 * 1000);
          const nextAttemptAt = new Date(Date.now() + backoffMs);
          const nextStatus = nextAttempts >= 5 ? 'Failed' : 'Pending';

          console.error(`[Trace: ${traceId}] [OutboxWorker] Failed to process outbox event ${event.id}:`, err);
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: nextStatus,
              attempts: nextAttempts,
              lastError: err.message,
              nextAttemptAt,
            },
          });
        }
      }

      if (processedIds.length > 0) {
        await prisma.outboxEvent.updateMany({
          where: { id: { in: processedIds } },
          data: {
            status: 'Processed',
            attempts: { increment: 1 },
            processedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('[OutboxWorker] Error in background worker loop:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
