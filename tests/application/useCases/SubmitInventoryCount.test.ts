import { SubmitInventoryCountUseCase } from '../../../src/application/useCases/SubmitInventoryCount';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';
import { WMSCapacityService } from '../../../src/domain/services/WMSCapacityService';
import { CountItemInputDTO } from '../../../src/application/dtos/SubmitInventoryCountDTO';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { CapacityExceededError } from '../../../src/domain/exceptions/DomainErrors';

describe('SubmitInventoryCountUseCase', () => {
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockEventDispatcher: jest.Mocked<DomainEventDispatcher>;
  let mockCapacityService: jest.Mocked<WMSCapacityService>;
  let useCase: SubmitInventoryCountUseCase;

  beforeEach(() => {
    mockInventoryRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findByLocation: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockEventDispatcher = {
      dispatch: jest.fn(),
    } as any;

    mockCapacityService = {
      validateCapacity: jest.fn(),
    } as any;

    // Use Case initialized without capacity service by default for basic tests
    useCase = new SubmitInventoryCountUseCase(
      mockInventoryRepo,
      mockEventDispatcher
    );
  });

  describe('execute', () => {
    it('should return empty array if counts input is empty', async () => {
      const result = await useCase.execute([]);

      expect(result).toEqual([]);
      expect(mockInventoryRepo.findBySkuAndLocationBatch).not.toHaveBeenCalled();
      expect(mockInventoryRepo.saveBatch).not.toHaveBeenCalled();
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should reconcile stock for existing items successfully (happy path)', async () => {
      const item1 = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      const item2 = new InventoryItem('2', new Sku('SKU2'), new LocationId('LOC2'), new Quantity(5));

      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([item1, item2]);

      const counts: CountItemInputDTO[] = [
        { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 8 }, // decrease
        { sku: 'SKU2', locationId: 'LOC2', actualQuantity: 7 }, // increase
      ];

      const result = await useCase.execute(counts);

      expect(mockInventoryRepo.findBySkuAndLocationBatch).toHaveBeenCalledWith([
        { sku: 'SKU1', locationId: 'LOC1' },
        { sku: 'SKU2', locationId: 'LOC2' },
      ]);

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([
        { sku: 'SKU1', locationId: 'LOC1', expected: 10, actual: 8, variance: -2 },
        { sku: 'SKU2', locationId: 'LOC2', expected: 5, actual: 7, variance: 2 },
      ]));

      expect(mockInventoryRepo.saveBatch).toHaveBeenCalledTimes(1);
      const savedItems = mockInventoryRepo.saveBatch.mock.calls[0][0];
      expect(savedItems).toHaveLength(2);
      expect(savedItems[0].quantity.value).toBe(8);
      expect(savedItems[1].quantity.value).toBe(7);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(2);
      const dispatchedEvents = mockEventDispatcher.dispatch.mock.calls.flatMap(call => call[0]);
      expect(dispatchedEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({ sku: 'SKU1', locationId: 'LOC1', expected: 10, actual: 8, variance: -2 }),
        expect.objectContaining({ sku: 'SKU2', locationId: 'LOC2', expected: 5, actual: 7, variance: 2 }),
      ]));
    });

    it('should create new inventory items if they do not exist', async () => {
      // Return empty array meaning no items exist yet
      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([]);

      const counts: CountItemInputDTO[] = [
        { sku: 'NEW-SKU', locationId: 'NEW-LOC', actualQuantity: 15 },
      ];

      const result = await useCase.execute(counts);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sku: 'NEW-SKU',
        locationId: 'NEW-LOC',
        expected: 0,
        actual: 15,
        variance: 15,
      });

      expect(mockInventoryRepo.saveBatch).toHaveBeenCalledTimes(1);
      const savedItems = mockInventoryRepo.saveBatch.mock.calls[0][0];
      expect(savedItems).toHaveLength(1);
      expect(savedItems[0].sku.value).toBe('NEW-SKU');
      expect(savedItems[0].locationId.value).toBe('NEW-LOC');
      expect(savedItems[0].quantity.value).toBe(15);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should validate capacity if WMSCapacityService is provided', async () => {
      const useCaseWithCapacity = new SubmitInventoryCountUseCase(
        mockInventoryRepo,
        mockEventDispatcher,
        mockCapacityService
      );

      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([]);
      mockCapacityService.validateCapacity.mockResolvedValue(undefined);

      const counts: CountItemInputDTO[] = [
        { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 10 },
        { sku: 'SKU2', locationId: 'LOC1', actualQuantity: 20 },
        { sku: 'SKU3', locationId: 'LOC2', actualQuantity: 5 },
      ];

      await useCaseWithCapacity.execute(counts);

      expect(mockCapacityService.validateCapacity).toHaveBeenCalledTimes(2);

      expect(mockCapacityService.validateCapacity).toHaveBeenCalledWith('LOC1', [
        { sku: 'SKU1', mode: 'absolute', quantity: 10 },
        { sku: 'SKU2', mode: 'absolute', quantity: 20 },
      ]);

      expect(mockCapacityService.validateCapacity).toHaveBeenCalledWith('LOC2', [
        { sku: 'SKU3', mode: 'absolute', quantity: 5 },
      ]);
    });

    it('should propagate capacity validation errors and abort', async () => {
      const useCaseWithCapacity = new SubmitInventoryCountUseCase(
        mockInventoryRepo,
        mockEventDispatcher,
        mockCapacityService
      );

      const capacityError = new CapacityExceededError('LOC1', 'weight', 1000, 1500);
      mockCapacityService.validateCapacity.mockRejectedValue(capacityError);

      const counts: CountItemInputDTO[] = [
        { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 50 },
      ];

      await expect(useCaseWithCapacity.execute(counts)).rejects.toThrow(CapacityExceededError);

      expect(mockInventoryRepo.findBySkuAndLocationBatch).not.toHaveBeenCalled();
      expect(mockInventoryRepo.saveBatch).not.toHaveBeenCalled();
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should propagate errors from repository saveBatch', async () => {
      const item = new InventoryItem('1', new Sku('SKU1'), new LocationId('LOC1'), new Quantity(10));
      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([item]);

      const dbError = new Error('Database connection failed');
      mockInventoryRepo.saveBatch.mockRejectedValue(dbError);

      const counts: CountItemInputDTO[] = [
        { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 8 },
      ];

      await expect(useCase.execute(counts)).rejects.toThrow('Database connection failed');

      expect(mockInventoryRepo.saveBatch).toHaveBeenCalled();
      // Should not dispatch events if save fails
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
