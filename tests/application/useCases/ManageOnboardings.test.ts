import { IStockOnboardingRepository } from '../../../src/domain/repositories/IStockOnboardingRepository';
import { CreateStockOnboardingUseCase } from '../../../src/application/useCases/ManageOnboardings';
import { StockOnboarding } from '../../../src/domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../../src/domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('ManageOnboardings Use Cases', () => {
  let mockRepo: jest.Mocked<IStockOnboardingRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      save: jest.fn(),
    } as any;
  });

  describe('CreateStockOnboardingUseCase', () => {
    it('should create and save a new stock onboarding entity successfully and return true', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);

      const input = {
        id: 'ob-123',
        tenantId: 'tenant-1',
        locationId: 'loc-1',
        asOfDate: '2024-01-01T00:00:00.000Z',
      };

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);

      const savedEntity = mockRepo.save.mock.calls[0][0];
      expect(savedEntity).toBeInstanceOf(StockOnboarding);
      expect(savedEntity.id).toEqual(new StockOnboardingId(input.id));
      expect(savedEntity.tenantId).toEqual(new TenantId(input.tenantId));
      expect(savedEntity.locationId).toEqual(new LocationId(input.locationId));
      expect(savedEntity.asOfDate).toEqual(new Date(input.asOfDate));
    });

    it('should fail if the provided ID is an empty string', async () => {
      const useCase = new CreateStockOnboardingUseCase(mockRepo);

      const input = {
        id: '',
        tenantId: 'tenant-1',
        locationId: 'loc-1',
        asOfDate: '2024-01-01T00:00:00.000Z',
      };

      await expect(useCase.execute(input)).rejects.toThrow('StockOnboardingId cannot be empty.');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
