import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { ReceiveStockUseCase } from '../../../src/application/useCases/ReceiveStock';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { WMSCapacityService } from '../../../src/domain/services/WMSCapacityService';

describe('ReceiveStockUseCase', () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let mockCapacityService: jest.Mocked<WMSCapacityService>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
      findByLocation: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    mockCapacityService = {
      validateCapacity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<WMSCapacityService>;
  });

  it('should receive stock and call capacity service if provided', async () => {
    const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
    mockRepo.findBySkuAndLocation.mockResolvedValue(item);

    const useCase = new ReceiveStockUseCase(mockRepo, mockCapacityService);
    const result = await useCase.execute('SKU1', 'LOC1', 5);

    expect(result.quantity).toBe(15);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
    expect(mockCapacityService.validateCapacity).toHaveBeenCalledWith('LOC1', [
      { sku: 'SKU1', mode: 'relative', quantity: 5 },
    ]);
  });

  it('should create new item if SKU not found and no capacity service is provided', async () => {
    mockRepo.findBySkuAndLocation.mockResolvedValue(null);

    const useCase = new ReceiveStockUseCase(mockRepo);
    const result = await useCase.execute('NEW-SKU', 'LOC1', 10);

    expect(result.sku).toBe('NEW-SKU');
    expect(result.quantity).toBe(10);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const savedItem = mockRepo.save.mock.calls[0][0];
    expect(savedItem.id).toEqual(expect.any(String));
    expect(savedItem.sku.value).toBe('NEW-SKU');
    expect(savedItem.locationId.value).toBe('LOC1');
    expect(savedItem.quantity.value).toBe(10);
  });

  it('should propagate capacity service error', async () => {
    const error = new Error('Capacity exceeded');
    mockCapacityService.validateCapacity.mockRejectedValue(error);

    const useCase = new ReceiveStockUseCase(mockRepo, mockCapacityService);

    await expect(useCase.execute('SKU1', 'LOC1', 5)).rejects.toThrow('Capacity exceeded');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
