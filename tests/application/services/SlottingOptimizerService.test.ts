import { SlottingOptimizerService, LocationCoordinate, InventoryItemLocation, DispatchRecord } from '../../../src/application/services/SlottingOptimizerService';

describe('SlottingOptimizerService', () => {
  let service: SlottingOptimizerService;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    service = new SlottingOptimizerService();
    originalFetch = global.fetch;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should return recommendations from sidecar when fetch is successful', async () => {
    const mockResponse = [{ sku: 'A', currentLocationId: 'L1', recommendedLocationId: 'L2', estimatedSavings: 10 }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const result = await service.getSlottingOptimization([], [], []);
    expect(result).toEqual(mockResponse);
  });

  it('should fallback to local heuristic on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Setup locations so LOC-FAR has distance 20 and LOC-NEAR has distance 2
    // locMap logic: |x| + |y| + 2*|z|
    const locations: LocationCoordinate[] = [
      { id: 'LOC-FAR', grid_x: 10, grid_y: 10 },
      { id: 'LOC-NEAR', grid_x: 1, grid_y: 1 }
    ];
    const inventory: InventoryItemLocation[] = [
      { sku: 'FAST-ITEM', location_id: 'LOC-FAR' },
      { sku: 'SLOW-ITEM', location_id: 'LOC-NEAR' }
    ];
    const dispatches: DispatchRecord[] = [
      { sku: 'FAST-ITEM', location_id: 'LOC-FAR', quantity: 100, date: '2023-01-01' },
      { sku: 'SLOW-ITEM', location_id: 'LOC-NEAR', quantity: 1, date: '2023-01-01' }
    ];

    const result = await service.getSlottingOptimization(locations, inventory, dispatches);

    // FAST-ITEM distance=20, velocity=100
    // SLOW-ITEM distance=2, velocity=1
    // Savings = 100 * (20 - 2) * 2 = 100 * 18 * 2 = 3600

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: 'FAST-ITEM',
      currentLocationId: 'LOC-FAR',
      currentDistance: 20,
      currentVelocity: 100,
      recommendedLocationId: 'LOC-NEAR',
      recommendedDistance: 2,
      potentialSwapSku: 'SLOW-ITEM',
      estimatedSavings: 3600
    });
  });

  it('should fallback to local heuristic on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    const locations: LocationCoordinate[] = [
      { id: 'LOC-FAR', grid_x: 10, grid_y: 10 },
      { id: 'LOC-NEAR', grid_x: 1, grid_y: 1 }
    ];
    const inventory: InventoryItemLocation[] = [
      { sku: 'FAST-ITEM', location_id: 'LOC-FAR' },
      { sku: 'SLOW-ITEM', location_id: 'LOC-NEAR' }
    ];
    const dispatches: DispatchRecord[] = [
      { sku: 'FAST-ITEM', location_id: 'LOC-FAR', quantity: 100, date: '2023-01-01' },
      { sku: 'SLOW-ITEM', location_id: 'LOC-NEAR', quantity: 1, date: '2023-01-01' }
    ];

    const result = await service.getSlottingOptimization(locations, inventory, dispatches);

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('FAST-ITEM');
  });
});
