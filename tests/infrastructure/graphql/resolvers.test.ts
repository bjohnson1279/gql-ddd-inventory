jest.mock('../../../src/infrastructure/persistence/PostgresInventoryRepository', () => {
  const { InMemoryInventoryRepository } = require('../../../src/infrastructure/persistence/InMemoryInventoryRepository');
  return {
    PostgresInventoryRepository: InMemoryInventoryRepository
  };
});

import { resolvers, prisma, pool } from '../../../src/infrastructure/graphql/resolvers';

// Mock the Prisma/Pool calls to prevent database connection attempts during test lifecycle
jest.spyOn(prisma.inventoryItem, 'deleteMany').mockImplementation(() => Promise.resolve({ count: 0 }) as any);
jest.spyOn(prisma, '$disconnect').mockImplementation(() => Promise.resolve());
jest.spyOn(pool, 'end').mockImplementation(() => Promise.resolve());

describe('GraphQL Resolvers', () => {
  beforeAll(async () => {
    // Clear the DB using the resolvers' Prisma client
    await prisma.inventoryItem.deleteMany({});
  }, 30000);

  afterAll(async () => {
    // Wait for any pending event bus tasks to complete before tearing down
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.$disconnect();
    await pool.end();
  });
  it('should receive stock through mutation', async () => {
    const result = await (resolvers.Mutation as any).receiveStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: 10 });
    
    expect(result.sku).toBe('SKU1');
    expect(result.quantity).toBe(10);
  });

  it('should query inventory items', async () => {
    // We just added SKU1 in the previous test
    const result = await (resolvers.Query as any).inventoryItems();
    
    expect(result.length).toBeGreaterThan(0);
    expect(result.find((item: any) => item.sku === 'SKU1')).toBeDefined();
  });

  it('should dispatch stock through mutation', async () => {
    const result = await (resolvers.Mutation as any).dispatchStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: 5 });
    
    expect(result.quantity).toBe(5);
  });

  it('should query inventory item by SKU', async () => {
    const result = await (resolvers.Query as any).inventoryItemBySku(null, { sku: 'SKU1' });
    
    expect(result[0].sku).toBe('SKU1');
    expect(result[0].quantity).toBe(5);
  });

  it('should query inventory item by SKU (null case)', async () => {
    const result = await (resolvers.Query as any).inventoryItemBySku(null, { sku: 'NON-EXISTENT' });
    expect(result).toEqual([]);
  });

  it('should handle errors in mutations (dispatchStock)', async () => {
    // Attempt to dispatch more than available
    await expect((resolvers.Mutation as any).dispatchStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: 100 }))
      .rejects.toThrow();
  });

  it('should handle errors in mutations (receiveStock)', async () => {
    // Attempt to receive negative amount
    await expect((resolvers.Mutation as any).receiveStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: -10 }))
      .rejects.toThrow();
  });

  it('should submit inventory count', async () => {
    const counts = [
      { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 20 },
      { sku: 'SKU2', locationId: 'LOC2', actualQuantity: 15 },
    ];
    const result = await (resolvers.Mutation as any).submitInventoryCount(null, { counts });
    
    expect(result).toHaveLength(2);
    expect(result[0].sku).toBe('SKU1');
    expect(result[0].actual).toBe(20);
    expect(result[1].sku).toBe('SKU2');
    expect(result[1].actual).toBe(15);
  });

  it('should handle errors in mutations (submitInventoryCount)', async () => {
    // Attempt to submit negative actual quantity
    const counts = [{ sku: 'SKU1', locationId: 'LOC1', actualQuantity: -5 }];
    await expect((resolvers.Mutation as any).submitInventoryCount(null, { counts }))
      .rejects.toThrow();
  });

  it('should submit opening balance', async () => {
    const input = {
      tenantId: 'T1',
      locationId: 'L1',
      asOfDate: '2024-01-01',
      actorId: 'A1',
      items: [
        { variantId: 'V1', quantity: 10, unitCostCents: 1000 }
      ]
    };
    const result = await (resolvers.Mutation as any).submitOpeningBalance(null, { input });
    expect(result).toBe(true);
  });
});
