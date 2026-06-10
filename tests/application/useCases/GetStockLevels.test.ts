import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import {
  GetStockLevelsUseCase,
  GetStockLevelsBySkuUseCase,
  GetStockLevelBySkuAndLocationUseCase,
} from '../../../src/application/useCases/GetStockLevels';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('GetStockLevels Use Cases', () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      findByLocation: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    };
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

      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU1');
      expect(result[0].locationId).toBe('LOC1');
      expect(result[0].quantity).toBe(10);
      expect(result[1].sku).toBe('SKU2');
      expect(result[1].locationId).toBe('LOC2');
      expect(result[1].quantity).toBe(20);
    });

    it('should return empty array if no stock levels exist', async () => {
      mockRepo.findAll.mockResolvedValue([]);

      const useCase = new GetStockLevelsUseCase(mockRepo);
      const result = await useCase.execute();

      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should retrieve all stock levels via findAll and map to DTO', async () => {
      const items = [
        new InventoryItem('3', new Sku('SKU3'), new LocationId('LOC3'), new Quantity(30)),
        new InventoryItem('4', new Sku('SKU4'), new LocationId('LOC4'), new Quantity(40)),
      ];
      mockRepo.findAll.mockResolvedValue(items);

      const useCase = new GetStockLevelsUseCase(mockRepo);
      const result = await useCase.execute();

      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU3');
      expect(result[0].locationId).toBe('LOC3');
      expect(result[0].quantity).toBe(30);
      expect(result[1].sku).toBe('SKU4');
      expect(result[1].locationId).toBe('LOC4');
      expect(result[1].quantity).toBe(40);
    });
  });

  describe('GetStockLevelsBySkuUseCase', () => {
    it('should return DTO array if items found for SKU', async () => {
      const items = [
        new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10)),
        new InventoryItem('2', new Sku('SKU1'), new LocationId('LOC2'), new Quantity(15)),
      ];
      mockRepo.findBySku.mockResolvedValue(items);

      const useCase = new GetStockLevelsBySkuUseCase(mockRepo);
      const result = await useCase.execute('SKU1');

      expect(mockRepo.findBySku).toHaveBeenCalledWith('SKU1');
      expect(mockRepo.findBySku).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].sku).toBe('SKU1');
      expect(result[0].locationId).toBe('LOC1');
      expect(result[1].sku).toBe('SKU1');
      expect(result[1].locationId).toBe('LOC2');
    });

    it('should return empty array if no items found for SKU', async () => {
      mockRepo.findBySku.mockResolvedValue([]);

      const useCase = new GetStockLevelsBySkuUseCase(mockRepo);
      const result = await useCase.execute('UNKNOWN-SKU');

      expect(mockRepo.findBySku).toHaveBeenCalledWith('UNKNOWN-SKU');
      expect(mockRepo.findBySku).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe('GetStockLevelBySkuAndLocationUseCase', () => {
    it('should return DTO if item found for SKU and location', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockRepo.findBySkuAndLocation.mockResolvedValue(item);

      const useCase = new GetStockLevelBySkuAndLocationUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'LOC1');

      expect(mockRepo.findBySkuAndLocation).toHaveBeenCalledWith('SKU1', 'LOC1');
      expect(mockRepo.findBySkuAndLocation).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.sku).toBe('SKU1');
      expect(result?.locationId).toBe('LOC1');
      expect(result?.quantity).toBe(10);
    });

    it('should return null if item not found for SKU and location', async () => {
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new GetStockLevelBySkuAndLocationUseCase(mockRepo);
      const result = await useCase.execute('SKU1', 'UNKNOWN-LOC');

      expect(mockRepo.findBySkuAndLocation).toHaveBeenCalledWith('SKU1', 'UNKNOWN-LOC');
      expect(mockRepo.findBySkuAndLocation).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });
});
