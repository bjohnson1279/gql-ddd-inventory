import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { ReceiveStockUseCase } from '../../../src/application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../../src/application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelsBySkuUseCase } from '../../../src/application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../../src/application/useCases/SubmitInventoryCount';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';

describe('Inventory Use Cases', () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let mockEventDispatcher: jest.Mocked<DomainEventDispatcher>;
  
  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkusAndLocations: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockEventDispatcher = {
      dispatch: jest.fn(),
    } as any;
  });

  describe('ReceiveStockUseCase', () => {
    it('should add stock to existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);
      
      const useCase = new ReceiveStockUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1', 5);

      expect(result.quantity).toBe(15);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should create new item if SKU not found', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);
      
      const useCase = new ReceiveStockUseCase(mockRepo);
      const result = await useCase.execute('NEW-SKU', 'LOC1', 10);

      expect(result.sku).toBe('NEW-SKU');
      expect(result.quantity).toBe(10);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('DispatchStockUseCase', () => {
    it('should remove stock from existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);
      
      const useCase = new DispatchStockUseCase(mockRepo, mockEventDispatcher);
      const result = await useCase.execute('SKU1', 'LOC1', 5);

      expect(result.quantity).toBe(5);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should throw error if SKU not found', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);
      
      const useCase = new DispatchStockUseCase(mockRepo, mockEventDispatcher);
      await expect(useCase.execute('SKU1', 'LOC1', 5)).rejects.toThrow('Item with SKU SKU1 at location LOC1 not found.');
    });
  });

  describe('GetStockLevelsUseCase', () => {
    it('should return all stock levels', async () => {
      const items = [
        new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10)),
        new InventoryItem('2', new Sku('SKU2'), new LocationId('LOC2'), new Quantity(20)),
      ];
      mockRepo.findAll.mockResolvedValue(items);
      
      const useCase = new GetStockLevelsUseCase(mockRepo);
      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU1');
      expect(result[1].sku).toBe('SKU2');
    });
  });

  describe('GetStockLevelsBySkuUseCase', () => {
    it('should return DTO array if item found', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySku.mockResolvedValue([item]);
      
      const useCase = new GetStockLevelsBySkuUseCase(mockRepo);
      const result = await useCase.execute('SKU1');

      expect(result[0]?.sku).toBe('SKU1');
    });

    it('should return empty array if item not found', async () => {
      mockRepo.findBySku.mockResolvedValue([]);
      
      const useCase = new GetStockLevelsBySkuUseCase(mockRepo);
      const result = await useCase.execute('SKU1');

      expect(result).toEqual([]);
    });
  });

  describe('SubmitInventoryCountUseCase', () => {
    it('should reconcile stock for multiple items', async () => {
      const item1 = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySkusAndLocations.mockResolvedValue([item1]);
      
      const useCase = new SubmitInventoryCountUseCase(mockRepo, mockEventDispatcher);
      const result = await useCase.execute([
        { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 8 },
        { sku: 'SKU2', locationId: 'LOC2', actualQuantity: 5 },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU1');
      expect(result[0].variance).toBe(-2);
      expect(result[1].sku).toBe('SKU2');
      expect(result[1].variance).toBe(5); // New item, so 5 - 0 = 5
      expect(mockRepo.saveBatch).toHaveBeenCalledTimes(1);
      expect(mockRepo.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sku: new Sku('SKU1') }),
          expect.objectContaining({ sku: new Sku('SKU2') })
        ])
      );
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(2);
    });
  });
});
