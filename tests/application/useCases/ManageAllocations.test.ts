import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import {
  AllocateStockUseCase,
  ReleaseAllocationUseCase,
  FulfillAllocationUseCase,
  CreateInTransitUseCase,
  ReceiveInTransitUseCase
} from '../../../src/application/useCases/ManageAllocations';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';

describe('ManageAllocations Use Cases', () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;

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
  });

  describe('AllocateStockUseCase', () => {
    describe('Additional Scenarios', () => {
      it('should handle sequential stock allocations correctly', async () => {
        const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(50));
        mockRepo.findBySkuAndLocation.mockResolvedValue(item);

        const useCase = new AllocateStockUseCase(mockRepo);

        const firstResult = await useCase.execute('SKU1', 'LOC1', 10);
        expect(firstResult.allocated).toBe(10);
        expect(firstResult.available).toBe(40);

        const secondResult = await useCase.execute('SKU1', 'LOC1', 15);
        expect(secondResult.allocated).toBe(25);
        expect(secondResult.available).toBe(25);

        expect(mockRepo.save).toHaveBeenCalledTimes(2);
      });

      it('should fail to allocate stock when requested amount exceeds available balance', async () => {
        const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
        mockRepo.findBySkuAndLocation.mockResolvedValue(item);

        const useCase = new AllocateStockUseCase(mockRepo);
        await expect(useCase.execute('SKU1', 'LOC1', 15)).rejects.toThrow(
          'Insufficient available stock'
        );
      });
    });

    it('should allocate stock to existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new AllocateStockUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1', 3);

      expect(result.allocated).toBe(3);
      expect(result.available).toBe(7);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw InsufficientAvailableStockError if allocating stock when item does not exist', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new AllocateStockUseCase(mockRepo);
      await expect(useCase.execute('NEW-SKU', 'LOC1', 5)).rejects.toThrow(
        'Insufficient available stock'
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should create new item and allocate successfully if item does not exist but amount is 0', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new AllocateStockUseCase(mockRepo);
      const result = await useCase.execute('NEW-SKU', 'LOC1', 0);

      expect(result.sku).toBe('NEW-SKU');
      expect(result.locationId).toBe('LOC1');
      expect(result.allocated).toBe(0);
      expect(result.available).toBe(0);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should allocate 0 stock to existing item without modifying total available/allocated', async () => {
      const item = new InventoryItem('2', new Sku('SKU2'), new LocationId('LOC2'), new Quantity(20));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new AllocateStockUseCase(mockRepo);
      const result = await useCase.execute('SKU2', 'LOC2', 0);

      expect(result.allocated).toBe(0);
      expect(result.available).toBe(20);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });
  });

  describe('ReleaseAllocationUseCase', () => {
    it('should release allocation from existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10), new Quantity(5));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new ReleaseAllocationUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1', 2);

      expect(result.allocated).toBe(3);
      expect(result.available).toBe(7);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw error if item does not exist', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new ReleaseAllocationUseCase(mockRepo);
      await expect(useCase.execute('SKU1', 'LOC1', 2)).rejects.toThrow(
        'Inventory item for SKU SKU1 at location LOC1 not found.'
      );
    });
  });

  describe('FulfillAllocationUseCase', () => {
    it('should fulfill allocation from existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10), new Quantity(5));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new FulfillAllocationUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1', 3);

      expect(result.quantity).toBe(7);
      expect(result.allocated).toBe(2);
      expect(result.available).toBe(5);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw error if item does not exist', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new FulfillAllocationUseCase(mockRepo);
      await expect(useCase.execute('SKU1', 'LOC1', 3)).rejects.toThrow(
        'Inventory item for SKU SKU1 at location LOC1 not found.'
      );
    });
  });

  describe('CreateInTransitUseCase', () => {
    it('should create in-transit stock for existing item', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new CreateInTransitUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1', 4);

      expect(result.inTransit).toBe(4);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should create new item and set in-transit stock if item does not exist', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new CreateInTransitUseCase(mockRepo);
      const result = await useCase.execute('NEW-SKU', 'LOC1', 6);

      expect(result.sku).toBe('NEW-SKU');
      expect(result.inTransit).toBe(6);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('ReceiveInTransitUseCase', () => {
    it('should receive in-transit stock for existing item', async () => {
      const item = new InventoryItem(
        '1',
        new Sku('SKU1'),
        new LocationId('LOC1'),
        new Quantity(10),
        new Quantity(0),
        new Quantity(5)
      );
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new ReceiveInTransitUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1', 3);

      expect(result.quantity).toBe(13);
      expect(result.inTransit).toBe(2);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw error if item does not exist', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new ReceiveInTransitUseCase(mockRepo);
      await expect(useCase.execute('SKU1', 'LOC1', 3)).rejects.toThrow(
        'Inventory item for SKU SKU1 at location LOC1 not found.'
      );
    });
  });
});
