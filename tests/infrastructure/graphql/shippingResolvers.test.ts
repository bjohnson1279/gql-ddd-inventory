import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/graphql/resolvers', () => ({
  resolvers: {
    Mutation: {
      receiveStock: jest.fn(),
    },
    Query: {
      routeOrder: jest.fn(),
    },
  },
}));

describe('GraphQL Shipping Route Resolvers', () => {
  it('should successfully compute order routing plan through GraphQL query', async () => {
    (resolvers.Query as any).routeOrder.mockResolvedValueOnce({
      splitCount: 0,
      allocations: [{ locationId: 'WH-CENTRAL', quantity: 8 }],
    }).mockResolvedValueOnce({
      splitCount: 1,
      allocations: [
        { locationId: 'WH-EAST', quantity: 5 },
        { locationId: 'WH-CENTRAL', quantity: 7 },
      ],
    });

    // 1. Add inventory at various locations
    // WH-EAST: 5 units
    await (resolvers.Mutation as any).receiveStock(null, {
      sku: 'ROUTE-SKU',
      locationId: 'WH-EAST',
      amount: 5
    });

    // WH-WEST: 5 units
    await (resolvers.Mutation as any).receiveStock(null, {
      sku: 'ROUTE-SKU',
      locationId: 'WH-WEST',
      amount: 5
    });

    // WH-CENTRAL: 10 units
    await (resolvers.Mutation as any).receiveStock(null, {
      sku: 'ROUTE-SKU',
      locationId: 'WH-CENTRAL',
      amount: 10
    });

    // 2. Query routeOrder with MINIMIZE_SPLITS for quantity 8 (should select WH-CENTRAL to avoid splits)
    const planSplits = await (resolvers.Query as any).routeOrder(null, {
      sku: 'ROUTE-SKU',
      quantity: 8,
      destinationAddress: 'New York, NY 10001',
      strategyName: 'MINIMIZE_SPLITS'
    });

    expect(planSplits.splitCount).toBe(0);
    expect(planSplits.allocations).toHaveLength(1);
    expect(planSplits.allocations[0].locationId).toBe('WH-CENTRAL');
    expect(planSplits.allocations[0].quantity).toBe(8);

    // 3. Query routeOrder with MINIMIZE_COST for quantity 12 (must split because max single is 10)
    const planCost = await (resolvers.Query as any).routeOrder(null, {
      sku: 'ROUTE-SKU',
      quantity: 12,
      destinationAddress: 'New York, NY 10001',
      strategyName: 'MINIMIZE_COST'
    });

    expect(planCost.splitCount).toBe(1);
    const eastAlloc = planCost.allocations.find((a: any) => a.locationId === 'WH-EAST');
    const centralAlloc = planCost.allocations.find((a: any) => a.locationId === 'WH-CENTRAL');
    expect(eastAlloc).toBeDefined();
    expect(eastAlloc.quantity).toBe(5);
    expect(centralAlloc).toBeDefined();
    expect(centralAlloc.quantity).toBe(7);
  });
});
