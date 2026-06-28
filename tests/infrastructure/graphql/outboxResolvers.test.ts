import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

describe('GraphQL Outbox Management Resolvers', () => {
  beforeAll(async () => {
    // Clear outbox events before tests
    await prisma.outboxEvent.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should retrieve outboxStats and deadLetterEvents with proper authorization', async () => {
    const context = {
      auth: {
        tenantId: 'test-outbox-tenant',
        actorId: 'admin-actor',
        role: 'admin'
      },
      prisma
    };

    // 1. Create a dummy outbox event with status Failed
    const failedEvent = await prisma.outboxEvent.create({
      data: {
        eventType: 'InventoryDecremented',
        payload: JSON.stringify({ variantId: { value: 'v-1' }, quantity: 5, tenantId: 'test-outbox-tenant' }),
        status: 'Failed',
        attempts: 5,
        lastError: 'Simulated network timeout error'
      }
    });

    // 2. Create a dummy outbox event with status Pending
    await prisma.outboxEvent.create({
      data: {
        eventType: 'LowStockAlertEvent',
        payload: JSON.stringify({ sku: 'SKU-1', locationId: 'LOC-1', currentQuantity: 2 }),
        status: 'Pending',
        attempts: 0
      }
    });

    // 3. Query outboxStats
    const stats = await resolvers.Query.outboxStats(null, {}, context);
    expect(stats.total).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.pending).toBe(1);

    // 4. Query deadLetterEvents
    const dlEvents = await resolvers.Query.deadLetterEvents(null, { limit: 10 }, context);
    expect(dlEvents).toHaveLength(1);
    expect(dlEvents[0].id).toBe(failedEvent.id);
    expect(dlEvents[0].payload).toContain('v-1');
    expect(dlEvents[0].nextAttemptAt).toBeDefined();

    // 5. Retry failed event via Mutation
    const retryResult = await resolvers.Mutation.retryOutboxEvent(null, { id: failedEvent.id }, context);
    expect(retryResult).toBe(true);

    // 6. Verify event is rescheduled in DB
    const rescheduled = await prisma.outboxEvent.findUnique({
      where: { id: failedEvent.id }
    });
    expect(rescheduled!.status).toBe('Pending');
    expect(rescheduled!.attempts).toBe(0);
    expect(rescheduled!.lastError).toBeNull();
  });

  it('should throw an error on outboxStats if not an admin', async () => {
    const context = {
      auth: {
        tenantId: 'test-outbox-tenant',
        actorId: 'operator-actor',
        role: 'warehouse_operator'
      },
      prisma
    };

    await expect(resolvers.Query.outboxStats(null, {}, context)).rejects.toThrow();
  });
});
