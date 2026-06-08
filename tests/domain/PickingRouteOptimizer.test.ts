import { PickingRouteOptimizer, PickItemInput } from '../../src/domain/services/PickingRouteOptimizer';
import { InMemoryWarehouseLocationRepository } from '../../src/infrastructure/persistence/InMemoryWarehouseLocationRepository';
import { WarehouseLocation } from '../../src/domain/entities/WarehouseLocation';

describe('PickingRouteOptimizer', () => {
  let locationRepo: InMemoryWarehouseLocationRepository;
  let optimizer: PickingRouteOptimizer;

  beforeEach(() => {
    locationRepo = new InMemoryWarehouseLocationRepository();
    optimizer = new PickingRouteOptimizer(locationRepo);
  });

  it('should group pick items by warehouse and sort by S-Shape serpentine path', async () => {
    // 1. Setup location mappings in WH1
    const l1 = WarehouseLocation.parsePath('WH1-ZONEA-A01-R01-S01-B01'); // Aisle 1, Rack 1 (Odd)
    const l2 = WarehouseLocation.parsePath('WH1-ZONEA-A01-R02-S01-B01'); // Aisle 1, Rack 2 (Odd)
    const l3 = WarehouseLocation.parsePath('WH1-ZONEA-A02-R01-S01-B01'); // Aisle 2, Rack 1 (Even)
    const l4 = WarehouseLocation.parsePath('WH1-ZONEA-A02-R02-S01-B01'); // Aisle 2, Rack 2 (Even)
    
    // Setup location in WH2
    const l5 = WarehouseLocation.parsePath('WH2-ZONEA-A01-R01-S01-B01');

    await locationRepo.save(l1);
    await locationRepo.save(l2);
    await locationRepo.save(l3);
    await locationRepo.save(l4);
    await locationRepo.save(l5);

    // 2. Unordered pick items input
    const pickItems: PickItemInput[] = [
      { sku: 'SKU-D', quantity: 5, locationId: 'WH1-ZONEA-A02-R01-S01-B01' },
      { sku: 'SKU-E', quantity: 2, locationId: 'WH2-ZONEA-A01-R01-S01-B01' },
      { sku: 'SKU-A', quantity: 1, locationId: 'WH1-ZONEA-A01-R02-S01-B01' },
      { sku: 'SKU-C', quantity: 10, locationId: 'WH1-ZONEA-A02-R02-S01-B01' },
      { sku: 'SKU-B', quantity: 3, locationId: 'WH1-ZONEA-A01-R01-S01-B01' }
    ];

    // 3. Optimize route
    const routes = await optimizer.optimizeRoute(pickItems);

    // Should have 2 routes (one for WH1, one for WH2)
    expect(routes).toHaveLength(2);

    const wh1Route = routes.find(r => r.warehouseId === 'WH1');
    const wh2Route = routes.find(r => r.warehouseId === 'WH2');

    expect(wh1Route).toBeDefined();
    expect(wh2Route).toBeDefined();

    // Check WH1 S-Shape sorting:
    // Aisle 1 (Odd): should sort ascending by rack: R01 first, then R02.
    // Aisle 2 (Even): should sort descending by rack: R02 first, then R01.
    const wh1Items = wh1Route!.items;
    expect(wh1Items).toHaveLength(4);

    expect(wh1Items[0].locationId).toBe('WH1-ZONEA-A01-R01-S01-B01'); // Aisle 1, Rack 1
    expect(wh1Items[1].locationId).toBe('WH1-ZONEA-A01-R02-S01-B01'); // Aisle 1, Rack 2
    expect(wh1Items[2].locationId).toBe('WH1-ZONEA-A02-R02-S01-B01'); // Aisle 2, Rack 2 (descending)
    expect(wh1Items[3].locationId).toBe('WH1-ZONEA-A02-R01-S01-B01'); // Aisle 2, Rack 1 (descending)

    // Check WH2 sorting
    expect(wh2Route!.items).toHaveLength(1);
    expect(wh2Route!.items[0].sku).toBe('SKU-E');
  });

  it('should support non-numeric alphabetical aisle sorting and serpentine traversal', async () => {
    // Alphabetical fallback (A is odd/1, B is even/2)
    const l1 = WarehouseLocation.parsePath('WH1-ZONEA-A-R01-S01-B01'); // Aisle A (Odd/1), Rack 1
    const l2 = WarehouseLocation.parsePath('WH1-ZONEA-A-R02-S01-B01'); // Aisle A (Odd/1), Rack 2
    const l3 = WarehouseLocation.parsePath('WH1-ZONEA-B-R01-S01-B01'); // Aisle B (Even/2), Rack 1
    const l4 = WarehouseLocation.parsePath('WH1-ZONEA-B-R02-S01-B01'); // Aisle B (Even/2), Rack 2

    await locationRepo.save(l1);
    await locationRepo.save(l2);
    await locationRepo.save(l3);
    await locationRepo.save(l4);

    const pickItems: PickItemInput[] = [
      { sku: 'SKU-1', quantity: 1, locationId: 'WH1-ZONEA-B-R01-S01-B01' },
      { sku: 'SKU-2', quantity: 1, locationId: 'WH1-ZONEA-A-R02-S01-B01' },
      { sku: 'SKU-3', quantity: 1, locationId: 'WH1-ZONEA-B-R02-S01-B01' },
      { sku: 'SKU-4', quantity: 1, locationId: 'WH1-ZONEA-A-R01-S01-B01' }
    ];

    const routes = await optimizer.optimizeRoute(pickItems);
    const items = routes[0].items;

    // Aisle A (Odd): R01 -> R02
    // Aisle B (Even): R02 -> R01
    expect(items[0].locationId).toBe('WH1-ZONEA-A-R01-S01-B01');
    expect(items[1].locationId).toBe('WH1-ZONEA-A-R02-S01-B01');
    expect(items[2].locationId).toBe('WH1-ZONEA-B-R02-S01-B01');
    expect(items[3].locationId).toBe('WH1-ZONEA-B-R01-S01-B01');
  });
});
