import { RouteOrder } from '../../../src/application/useCases/RouteOrder';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';

describe('RouteOrder UseCase', () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let mockCarrierService: any;
  let routeOrder: RouteOrder;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockCarrierService = {
      getRates: jest.fn()
    };

    routeOrder = new RouteOrder(mockRepo, mockCarrierService);
  });

  it('should use fallback rate of 999999 when carrierService throws an exception', async () => {
    const sku = new Sku('TEST-SKU');
    const locationId = new LocationId('WH1');

    const item = new InventoryItem(
      'id-1',
      sku,
      locationId,
      new Quantity(10)
    );
    mockRepo.findBySku.mockResolvedValue([item]);

    mockCarrierService.getRates.mockRejectedValue(new Error('API Down'));

    const plan = await routeOrder.execute({
      sku: 'TEST-SKU',
      quantity: 5,
      destinationAddress: '10001 New York'
    });

    expect(plan).toBeDefined();
    expect(plan.allocations.length).toBe(1);
    expect(plan.allocations[0].locationId).toBe('WH1');
    expect(plan.allocations[0].quantity).toBe(5);
    expect(plan.estimatedShippingCostCents).toBe(999999);
  });

  it('should use fallback rate of 999999 when carrierService throws a synchronous exception', async () => {
    const sku = new Sku('TEST-SKU');
    const locationId = new LocationId('WH1');

    const item = new InventoryItem(
      'id-1',
      sku,
      locationId,
      new Quantity(10)
    );
    mockRepo.findBySku.mockResolvedValue([item]);

    // Explicitly test the synchronous exception scenario for fallback coverage
    mockCarrierService.getRates.mockImplementation(() => {
      throw new Error('Sync API Down');
    });

    const plan = await routeOrder.execute({
      sku: 'TEST-SKU',
      quantity: 5,
      destinationAddress: '10001 New York'
    });

    expect(plan.estimatedShippingCostCents).toBe(999999);
  });

  it('should use fallback rate of 999999 when carrierService returns empty rates', async () => {
    const sku = new Sku('TEST-SKU');
    const locationId = new LocationId('WH1');

    const item = new InventoryItem(
      'id-1',
      sku,
      locationId,
      new Quantity(10)
    );
    mockRepo.findBySku.mockResolvedValue([item]);

    mockCarrierService.getRates.mockResolvedValue([]);

    const plan = await routeOrder.execute({
      sku: 'TEST-SKU',
      quantity: 5,
      destinationAddress: '10001 New York'
    });

    expect(plan.estimatedShippingCostCents).toBe(999999);
  });

  it('should use the minimum rate when carrierService returns valid rates', async () => {
    const sku = new Sku('TEST-SKU');
    const locationId = new LocationId('WH1');

    const item = new InventoryItem(
      'id-1',
      sku,
      locationId,
      new Quantity(10)
    );
    mockRepo.findBySku.mockResolvedValue([item]);

    mockCarrierService.getRates.mockResolvedValue([
      { rateCents: 1500 },
      { cost: 1000 },
      { rateCents: 1200 }
    ]);

    const plan = await routeOrder.execute({
      sku: 'TEST-SKU',
      quantity: 5,
      destinationAddress: '10001 New York'
    });

    expect(plan.estimatedShippingCostCents).toBe(1000);
  });
});
