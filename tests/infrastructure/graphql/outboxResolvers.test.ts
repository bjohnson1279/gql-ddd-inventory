import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => {
  return {
    prisma: {
      outboxEvent: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn()
      }
    }
  };
});

describe('GraphQL Outbox Management Resolvers', () => {
  it('should retrieve outboxStats and deadLetterEvents with proper authorization', async () => {
    const context = {
      auth: {
        tenantId: 'test-outbox-tenant',
        actorId: 'admin-actor',
        role: 'admin'
      },
      prisma
    };

    const countMock = prisma.outboxEvent.count as jest.Mock;
    const findManyMock = prisma.outboxEvent.findMany as jest.Mock;
    const findUniqueMock = prisma.outboxEvent.findUnique as jest.Mock;
    const updateMock = prisma.outboxEvent.update as jest.Mock;

    // Mock count calls for pending, processing, processed, failed
    countMock.mockResolvedValueOnce(1); // pending
    countMock.mockResolvedValueOnce(0); // processing
    countMock.mockResolvedValueOnce(5); // processed
    countMock.mockResolvedValueOnce(1); // failed

    // 1. Query outboxStats
    const stats = await resolvers.Query.outboxStats(null, {}, context);
    expect(stats.total).toBe(7);
    expect(stats.failed).toBe(1);
    expect(stats.pending).toBe(1);

    // Mock findMany for dead-letter events
    const mockFailedEvent = {
      id: 'evt-1',
      eventType: 'InventoryDecremented',
      payload: JSON.stringify({ variantId: { value: 'v-1' }, quantity: 5, tenantId: 'test-outbox-tenant' }),
      status: 'Failed',
      attempts: 5,
      lastError: 'Simulated network timeout error',
      createdAt: new Date(),
      processedAt: null,
      nextAttemptAt: new Date()
    };
    findManyMock.mockResolvedValueOnce([mockFailedEvent]);

    // 2. Query deadLetterEvents
    const dlEvents = await resolvers.Query.deadLetterEvents(null, { limit: 10 }, context);
    expect(dlEvents).toHaveLength(1);
    expect(dlEvents[0].id).toBe('evt-1');
    expect(dlEvents[0].payload).toContain('v-1');
    expect(dlEvents[0].nextAttemptAt).toBeDefined();

    // Mock findUnique and update for retry mutation
    findUniqueMock.mockResolvedValueOnce(mockFailedEvent);
    updateMock.mockResolvedValueOnce({ ...mockFailedEvent, status: 'Pending', attempts: 0 });

    // 3. Retry failed event via Mutation
    const retryResult = await resolvers.Mutation.retryOutboxEvent(null, { id: 'evt-1' }, context);
    expect(retryResult).toBe(true);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        status: 'Pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: expect.any(Date)
      }
    });
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
