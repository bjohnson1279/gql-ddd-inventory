import { IStockOnboardingRepository } from '../../../src/domain/repositories/IStockOnboardingRepository';
import {
  CreateStockOnboardingUseCase,
  SaveStockOnboardingItemsUseCase,
  SubmitStockOnboardingUseCase,
  GetStockOnboardingUseCase,
  GetStockOnboardingsUseCase,
} from '../../../src/application/useCases/ManageOnboardings';
import { OpeningBalanceService } from '../../../src/domain/services/OpeningBalanceService';
import { StockOnboarding } from '../../../src/domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../../src/domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

describe('ManageOnboardings Use Cases', () => {
  let mockRepo: jest.Mocked<IStockOnboardingRepository>;
  let mockOpeningBalanceService: jest.Mocked<OpeningBalanceService>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      save: jest.fn(),
    } as any;

    mockOpeningBalanceService = {
      process: jest.fn(),
    } as any;
  });

  describe('CreateStockOnboardingUseCase', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create and save a new stock onboarding entity successfully and return the generated ID', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);

      const input = {
        tenantId: 'tenant-1',
        locationId: 'loc-1',
      };

      const result = await useCase.execute(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);

      const savedEntity = mockRepo.save.mock.calls[0][0];
      expect(savedEntity).toBeInstanceOf(StockOnboarding);
      expect(savedEntity.id.value).toEqual(result);
      expect(savedEntity.tenantId).toEqual(new TenantId(input.tenantId));
      expect(savedEntity.locationId).toEqual(new LocationId(input.locationId));
      expect(savedEntity.asOfDate).toEqual(new Date('2023-01-01T00:00:00Z'));
    });

    it('should generate unique IDs across successive calls', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);

      const input = {
        tenantId: 'tenant-1',
        locationId: 'loc-1',
      };

      const result1 = await useCase.execute(input);
      const result2 = await useCase.execute(input);

      expect(result1).not.toEqual(result2);
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
      expect(mockRepo.save).toHaveBeenNthCalledWith(1, expect.objectContaining({
        id: new StockOnboardingId(result1),
        tenantId: new TenantId(input.tenantId),
        locationId: new LocationId(input.locationId),
      }));
      expect(mockRepo.save).toHaveBeenNthCalledWith(2, expect.objectContaining({
        id: new StockOnboardingId(result2),
        tenantId: new TenantId(input.tenantId),
        locationId: new LocationId(input.locationId),
      }));
    });

    it('should fail if the provided tenant ID is an empty string', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);

      const input = {
        tenantId: '',
        locationId: 'loc-1',
      };

      await expect(useCase.execute(input)).rejects.toThrow('TenantId cannot be empty.');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should fail if the provided location ID is an empty string', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);

      const input = {
        tenantId: 'tenant-1',
        locationId: '',
      };

      await expect(useCase.execute(input)).rejects.toThrow('LocationId cannot be empty.');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors if saving to the repository fails', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);
      mockRepo.save.mockRejectedValue(new Error('Database connection failed.'));

      const input = {
        tenantId: 'tenant-1',
        locationId: 'loc-1',
      };

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed.');
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('SaveStockOnboardingItemsUseCase', () => {
    it('should save items to an existing stock onboarding successfully', async () => {
      const useCase = new SaveStockOnboardingItemsUseCase(mockRepo);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      mockRepo.findById.mockResolvedValue(existingOnboarding);

      const input = {
        id: 'ob-123',
        items: [
          { variantId: 'var-1', quantity: 10, unitCostCents: 1000 },
          { variantId: 'var-2', quantity: 20, unitCostCents: 2000 },
        ],
      };

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(mockRepo.findById).toHaveBeenCalledWith(onboardingId);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);

      const savedEntity = mockRepo.save.mock.calls[0][0];
      expect(savedEntity.items).toHaveLength(2);

      const item1 = savedEntity.items.find((i: any) => i.variantId.value === 'var-1');
      expect(item1).toBeDefined();
      expect(item1?.quantity).toBe(10);
      expect(item1?.unitCostCents).toBe(1000);
    });

    it('should throw an error if the stock onboarding is not found', async () => {
      const useCase = new SaveStockOnboardingItemsUseCase(mockRepo);

      mockRepo.findById.mockResolvedValue(null);

      const input = {
        id: 'ob-123',
        items: [{ variantId: 'var-1', quantity: 10, unitCostCents: 1000 }],
      };

      await expect(useCase.execute(input)).rejects.toThrow('Stock onboarding ob-123 not found.');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should fail if an item quantity is negative', async () => {
      const useCase = new SaveStockOnboardingItemsUseCase(mockRepo);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      mockRepo.findById.mockResolvedValue(existingOnboarding);

      const input = {
        id: 'ob-123',
        items: [{ variantId: 'var-1', quantity: -10, unitCostCents: 1000 }],
      };

      await expect(useCase.execute(input)).rejects.toThrow('Opening balance quantity cannot be negative.');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should fail if an item unitCostCents is negative', async () => {
      const useCase = new SaveStockOnboardingItemsUseCase(mockRepo);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      mockRepo.findById.mockResolvedValue(existingOnboarding);

      const input = {
        id: 'ob-123',
        items: [{ variantId: 'var-1', quantity: 10, unitCostCents: -1000 }],
      };

      await expect(useCase.execute(input)).rejects.toThrow('Unit cost cannot be negative.');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('SubmitStockOnboardingUseCase', () => {
    it('should submit the stock onboarding and process opening balances', async () => {
      const useCase = new SubmitStockOnboardingUseCase(mockRepo, mockOpeningBalanceService);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      // Need an item to submit
      existingOnboarding.setItem(new ProductVariantId('var-1'), 10, 1000);
      mockRepo.findById.mockResolvedValue(existingOnboarding);

      const actorId = 'actor-1';
      const result = await useCase.execute('ob-123', actorId);

      expect(result).toBe(true);
      expect(mockRepo.findById).toHaveBeenCalledWith(onboardingId);
      expect(existingOnboarding.isSubmitted).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledWith(existingOnboarding);
      expect(mockOpeningBalanceService.process).toHaveBeenCalledWith(existingOnboarding, new ActorId(actorId));
    });

    it('should throw an error if the stock onboarding is not found during submission', async () => {
      const useCase = new SubmitStockOnboardingUseCase(mockRepo, mockOpeningBalanceService);

      mockRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('ob-123', 'actor-1')).rejects.toThrow('Stock onboarding ob-123 not found.');
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockOpeningBalanceService.process).not.toHaveBeenCalled();
    });

    it('should throw an error if submitting an empty onboarding', async () => {
      const useCase = new SubmitStockOnboardingUseCase(mockRepo, mockOpeningBalanceService);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      // No items added
      mockRepo.findById.mockResolvedValue(existingOnboarding);

      await expect(useCase.execute('ob-123', 'actor-1')).rejects.toThrow('Cannot submit a stock onboarding with no items.');
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockOpeningBalanceService.process).not.toHaveBeenCalled();
    });

    it('should throw an error if submitting an already submitted onboarding', async () => {
      const useCase = new SubmitStockOnboardingUseCase(mockRepo, mockOpeningBalanceService);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      existingOnboarding.setItem(new ProductVariantId('var-1'), 10, 1000);
      existingOnboarding.submit();

      mockRepo.findById.mockResolvedValue(existingOnboarding);

      await expect(useCase.execute('ob-123', 'actor-1')).rejects.toThrow();
    });
  });

  describe('GetStockOnboardingUseCase', () => {
    it('should return a stock onboarding if found', async () => {
      const useCase = new GetStockOnboardingUseCase(mockRepo);

      const onboardingId = new StockOnboardingId('ob-123');
      const existingOnboarding = new StockOnboarding(
        onboardingId,
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new Date()
      );
      mockRepo.findById.mockResolvedValue(existingOnboarding);

      const result = await useCase.execute('ob-123');

      expect(result).toBe(existingOnboarding);
      expect(mockRepo.findById).toHaveBeenCalledWith(onboardingId);
    });

    it('should return null if stock onboarding is not found', async () => {
      const useCase = new GetStockOnboardingUseCase(mockRepo);

      mockRepo.findById.mockResolvedValue(null);

      const result = await useCase.execute('ob-123');

      expect(result).toBeNull();
      expect(mockRepo.findById).toHaveBeenCalledWith(new StockOnboardingId('ob-123'));
    });
  });

  describe('GetStockOnboardingsUseCase', () => {
    it('should return a list of stock onboardings for a tenant', async () => {
      const useCase = new GetStockOnboardingsUseCase(mockRepo);

      const tenantId = new TenantId('tenant-1');
      const onboardings = [
        new StockOnboarding(
          new StockOnboardingId('ob-123'),
          tenantId,
          new LocationId('loc-1'),
          new Date()
        ),
        new StockOnboarding(
          new StockOnboardingId('ob-456'),
          tenantId,
          new LocationId('loc-2'),
          new Date()
        ),
      ];
      mockRepo.findAllByTenant.mockResolvedValue(onboardings);

      const result = await useCase.execute('tenant-1');

      expect(result).toBe(onboardings);
      expect(mockRepo.findAllByTenant).toHaveBeenCalledWith(tenantId);
    });
  });
});
