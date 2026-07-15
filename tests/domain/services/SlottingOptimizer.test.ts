import { SlottingOptimizer } from '../../../src/domain/services/SlottingOptimizer';

describe('SlottingOptimizer (GraphQL)', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      warehouseLocation: {
        findMany: jest.fn(),
      },
      ledgerEntry: {
        findMany: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
      },
    };
  });

  it('should generate suggestions by calculating Manhattan distances and ledger sales velocities', async () => {
    // 1. Setup locations
    mockPrisma.warehouseLocation.findMany.mockResolvedValue([
      { id: 'LOC-CLOSE', gridX: 1, gridY: 1 },
      { id: 'LOC-FAR', gridX: 10, gridY: 10 },
    ]);

    // 2. Setup ledger dispatches (sales)
    mockPrisma.ledgerEntry.findMany.mockResolvedValue([
      {
        locationId: 'LOC-FAR',
        quantity: -50, // signed sales
        variant: { sku: 'SKU-HIGH' }
      },
      {
        locationId: 'LOC-CLOSE',
        quantity: -2,
        variant: { sku: 'SKU-LOW' }
      }
    ]);

    // 3. Setup inventory items
    mockPrisma.inventoryItem.findMany.mockResolvedValue([
      { sku: 'SKU-HIGH', locationId: 'LOC-FAR' },
      { sku: 'SKU-LOW', locationId: 'LOC-CLOSE' },
    ]);

    const optimizer = new SlottingOptimizer(mockPrisma);
    const suggestions = await optimizer.generateSuggestions();

    expect(suggestions).toHaveLength(1);
    const sugg = suggestions[0];
    expect(sugg.sku).toBe('SKU-HIGH');
    expect(sugg.currentLocationId).toBe('LOC-FAR');
    expect(sugg.currentDistance).toBe(20);
    expect(sugg.currentVelocity).toBe(50);
    expect(sugg.recommendedLocationId).toBe('LOC-CLOSE');
    expect(sugg.recommendedDistance).toBe(2);
    expect(sugg.potentialSwapSku).toBe('SKU-LOW');

    // maxDistanceDiff = 20 - 2 = 18
    // velocity = 50
    // estimatedSavings = 50 * 18 * 2 = 1800
    expect(sugg.estimatedSavings).toBe(1800);
  });
});
