import { DispatchStockUseCase } from '../../../src/application/useCases/DispatchStock';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { InsufficientStockError } from '../../../src/domain/exceptions/DomainErrors';

describe('DispatchStockUseCase', () => {
  let mockInventoryRepository: jest.Mocked<IInventoryRepository>;
  let mockEventDispatcher: jest.Mocked<DomainEventDispatcher>;

  beforeEach(() => {
    mockInventoryRepository = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockEventDispatcher = {
      dispatch: jest.fn(),
    } as any;
  });

  it('should dispatch stock successfully when item exists and has sufficient quantity', async () => {
    const initialQuantity = 10;
    const amountToDispatch = 5;
    const skuStr = 'SKU123';
    const locationIdStr = 'LOC1';

    const item = new InventoryItem(
      'id1',
      new Sku(skuStr),
      new LocationId(locationIdStr),
      new Quantity(initialQuantity)
    );

    mockInventoryRepository.findBySkuAndLocation.mockResolvedValue(item);

    const useCase = new DispatchStockUseCase(mockInventoryRepository, mockEventDispatcher);
    const result = await useCase.execute(skuStr, locationIdStr, amountToDispatch);

    expect(mockInventoryRepository.findBySkuAndLocation).toHaveBeenCalledWith(skuStr, locationIdStr);
    expect(mockInventoryRepository.save).toHaveBeenCalledWith(item);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalled();

    expect(result.sku).toBe(skuStr);
    expect(result.locationId).toBe(locationIdStr);
    expect(result.quantity).toBe(initialQuantity - amountToDispatch);
  });

  it('should throw an error when the item is not found', async () => {
    const skuStr = 'NON_EXISTENT_SKU';
    const locationIdStr = 'LOC1';

    mockInventoryRepository.findBySkuAndLocation.mockResolvedValue(null);

    const useCase = new DispatchStockUseCase(mockInventoryRepository, mockEventDispatcher);

    await expect(useCase.execute(skuStr, locationIdStr, 5)).rejects.toThrow(
      `Item with SKU ${skuStr} at location ${locationIdStr} not found.`
    );

    expect(mockInventoryRepository.findBySkuAndLocation).toHaveBeenCalledWith(skuStr, locationIdStr);
    expect(mockInventoryRepository.save).not.toHaveBeenCalled();
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should dispatch stock successfully when dispatching exactly the available amount (reaching 0)', async () => {
    const initialQuantity = 5;
    const amountToDispatch = 5;
    const skuStr = 'SKU123';
    const locationIdStr = 'LOC1';

    const item = new InventoryItem(
      'id1',
      new Sku(skuStr),
      new LocationId(locationIdStr),
      new Quantity(initialQuantity)
    );

    mockInventoryRepository.findBySkuAndLocation.mockResolvedValue(item);

    const useCase = new DispatchStockUseCase(mockInventoryRepository, mockEventDispatcher);
    const result = await useCase.execute(skuStr, locationIdStr, amountToDispatch);

    expect(mockInventoryRepository.findBySkuAndLocation).toHaveBeenCalledWith(skuStr, locationIdStr);
    expect(mockInventoryRepository.save).toHaveBeenCalledWith(item);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalled();

    expect(result.sku).toBe(skuStr);
    expect(result.locationId).toBe(locationIdStr);
    expect(result.quantity).toBe(0);
  });

  it('should throw an error when there is insufficient stock', async () => {
    const initialQuantity = 3;
    const amountToDispatch = 5;
    const skuStr = 'SKU123';
    const locationIdStr = 'LOC1';

    const item = new InventoryItem(
      'id1',
      new Sku(skuStr),
      new LocationId(locationIdStr),
      new Quantity(initialQuantity)
    );

    mockInventoryRepository.findBySkuAndLocation.mockResolvedValue(item);

    const useCase = new DispatchStockUseCase(mockInventoryRepository, mockEventDispatcher);

    await expect(useCase.execute(skuStr, locationIdStr, amountToDispatch)).rejects.toThrow(InsufficientStockError);

    expect(mockInventoryRepository.findBySkuAndLocation).toHaveBeenCalledWith(skuStr, locationIdStr);
    expect(mockInventoryRepository.save).not.toHaveBeenCalled();
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
  });
});
