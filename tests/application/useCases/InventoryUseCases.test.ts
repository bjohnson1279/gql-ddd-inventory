import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { ReceiveStockUseCase } from '../../../src/application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../../src/application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelBySkuUseCase } from '../../../src/application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../../src/application/useCases/SubmitInventoryCount';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { Sku } from '../../../src/domain/valueObjects/Sku';

describe('Inventory Use Cases', () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  
  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
    } as any;
  });

  describe('ReceiveStockUseCase', () => {
    it('should add stock to existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new Quantity(10));
      mockRepo.findBySku.mockResolvedValue(item);
      
      const useCase = new ReceiveStockUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 5);

      expect(result.quantity).toBe(15);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should create new item if SKU not found', async () => {
      mockRepo.findBySku.mockResolvedValue(null);
      
      const useCase = new ReceiveStockUseCase(mockRepo);
      const result = await useCase.execute('NEW-SKU', 10);

      expect(result.sku).toBe('NEW-SKU');
      expect(result.quantity).toBe(10);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('DispatchStockUseCase', () => {
    it('should remove stock from existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new Quantity(10));
      mockRepo.findBySku.mockResolvedValue(item);
      
      const useCase = new DispatchStockUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 5);

      expect(result.quantity).toBe(5);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw error if SKU not found', async () => {
      mockRepo.findBySku.mockResolvedValue(null);
      
      const useCase = new DispatchStockUseCase(mockRepo);
      await expect(useCase.execute('SKU1', 5)).rejects.toThrow('Item with SKU SKU1 not found.');
    });
  });

  describe('GetStockLevelsUseCase', () => {
    it('should return all stock levels', async () => {
      const items = [
        new InventoryItem('1', new Sku('SKU1'), new Quantity(10)),
        new InventoryItem('2', new Sku('SKU2'), new Quantity(20)),
      ];
      mockRepo.findAll.mockResolvedValue(items);
      
      const useCase = new GetStockLevelsUseCase(mockRepo);
      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU1');
      expect(result[1].sku).toBe('SKU2');
    });
  });

  describe('GetStockLevelBySkuUseCase', () => {
    it('should return DTO if item found', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new Quantity(10));
      mockRepo.findBySku.mockResolvedValue(item);
      
      const useCase = new GetStockLevelBySkuUseCase(mockRepo);
      const result = await useCase.execute('SKU1');

      expect(result?.sku).toBe('SKU1');
    });

    it('should return null if item not found', async () => {
      mockRepo.findBySku.mockResolvedValue(null);
      
      const useCase = new GetStockLevelBySkuUseCase(mockRepo);
      const result = await useCase.execute('SKU1');

      expect(result).toBeNull();
    });
  });

  describe('SubmitInventoryCountUseCase', () => {
    it('should reconcile stock for multiple items', async () => {
      const item1 = new InventoryItem('1', new Sku('SKU1'), new Quantity(10));
      mockRepo.findBySku.mockResolvedValueOnce(item1).mockResolvedValueOnce(null);
      
      const useCase = new SubmitInventoryCountUseCase(mockRepo);
      const result = await useCase.execute([
        { sku: 'SKU1', actualQuantity: 8 },
        { sku: 'SKU2', actualQuantity: 5 },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU1');
      expect(result[0].variance).toBe(-2);
      expect(result[1].sku).toBe('SKU2');
      expect(result[1].variance).toBe(5); // New item, so 5 - 0 = 5
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });
  });
});
