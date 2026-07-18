import {
  GetTenantAccountingConfigUseCase,
  SaveTenantAccountingConfigUseCase,
} from '../../../src/application/useCases/ManageTenantAccountingConfig';
import { ITenantAccountingConfigRepository } from '../../../src/domain/repositories/ITenantAccountingConfigRepository';
import { AccountingMethod, CostingMethod } from '../../../src/domain/enums/AccountingEnums';
import { InvalidOperationError } from '../../../src/domain/exceptions/DomainErrors';

describe('ManageTenantAccountingConfig UseCases', () => {
  let repositoryMock: jest.Mocked<ITenantAccountingConfigRepository>;

  beforeEach(() => {
    repositoryMock = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
    };
  });

  describe('GetTenantAccountingConfigUseCase', () => {
    it('should return default config if none exists', async () => {
      repositoryMock.findByTenantId.mockResolvedValue(null);

      const useCase = new GetTenantAccountingConfigUseCase(repositoryMock);
      const result = await useCase.execute('tenant-1');

      expect(repositoryMock.findByTenantId).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual({
        tenantId: 'tenant-1',
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: CostingMethod.FIFO,
      });
    });

    it('should return existing config', async () => {
      repositoryMock.findByTenantId.mockResolvedValue({
        tenantId: 'tenant-2',
        accountingMethod: AccountingMethod.Cash,
        costingMethod: CostingMethod.LIFO,
      });

      const useCase = new GetTenantAccountingConfigUseCase(repositoryMock);
      const result = await useCase.execute('tenant-2');

      expect(repositoryMock.findByTenantId).toHaveBeenCalledWith('tenant-2');
      expect(result).toEqual({
        tenantId: 'tenant-2',
        accountingMethod: AccountingMethod.Cash,
        costingMethod: CostingMethod.LIFO,
      });
    });

    it('should handle repository errors when finding unique config', async () => {
      const dbError = new Error('Database connection failed');
      repositoryMock.findByTenantId.mockRejectedValue(dbError);

      const useCase = new GetTenantAccountingConfigUseCase(repositoryMock);

      await expect(useCase.execute('tenant-3')).rejects.toThrow('Database connection failed');
      expect(repositoryMock.findByTenantId).toHaveBeenCalledWith('tenant-3');
    });

    it('should gracefully handle empty string for tenantId', async () => {
      repositoryMock.findByTenantId.mockResolvedValue(null);

      const useCase = new GetTenantAccountingConfigUseCase(repositoryMock);
      const result = await useCase.execute('');

      expect(repositoryMock.findByTenantId).toHaveBeenCalledWith('');
      expect(result).toEqual({
        tenantId: '',
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: CostingMethod.FIFO,
      });
    });

    it('should throw InvalidOperationError if repository returns an invalid accountingMethod', async () => {
      repositoryMock.findByTenantId.mockResolvedValue({
        tenantId: 'tenant-4',
        accountingMethod: 'invalid-accounting' as any,
        costingMethod: CostingMethod.FIFO,
      });

      const useCase = new GetTenantAccountingConfigUseCase(repositoryMock);

      await expect(useCase.execute('tenant-4')).rejects.toThrow(InvalidOperationError);
      await expect(useCase.execute('tenant-4')).rejects.toThrow('Invalid accounting method found in database: invalid-accounting');
    });

    it('should throw InvalidOperationError if repository returns an invalid costingMethod', async () => {
      repositoryMock.findByTenantId.mockResolvedValue({
        tenantId: 'tenant-5',
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: 'invalid-costing' as any,
      });

      const useCase = new GetTenantAccountingConfigUseCase(repositoryMock);

      await expect(useCase.execute('tenant-5')).rejects.toThrow(InvalidOperationError);
      await expect(useCase.execute('tenant-5')).rejects.toThrow('Invalid costing method found in database: invalid-costing');
    });
  });

  describe('SaveTenantAccountingConfigUseCase', () => {
    it('should throw InvalidOperationError if input is missing', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(prismaMock as PrismaClient);

      await expect(useCase.execute(null as any)).rejects.toThrow(InvalidOperationError);
      await expect(useCase.execute(null as any)).rejects.toThrow('Input is required');

      await expect(useCase.execute(undefined as any)).rejects.toThrow(InvalidOperationError);
      await expect(useCase.execute(undefined as any)).rejects.toThrow('Input is required');

      expect(prismaMock.tenantAccountingConfig.upsert).not.toHaveBeenCalled();
    });

    it('should save config correctly using upsert', async () => {
      prismaMock.tenantAccountingConfig.upsert.mockResolvedValue({});

      const useCase = new SaveTenantAccountingConfigUseCase(repositoryMock);
      const result = await useCase.execute({
        tenantId: 'tenant-3',
        accountingMethod: AccountingMethod.Cash,
        costingMethod: CostingMethod.WeightedAverageCost,
      });

      expect(repositoryMock.save).toHaveBeenCalledWith({
        tenantId: 'tenant-3',
        accountingMethod: AccountingMethod.Cash,
        costingMethod: CostingMethod.WeightedAverageCost,
      });
      expect(result).toBe(true);
    });

    it('should throw InvalidOperationError if tenantId is empty', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(repositoryMock);

      await expect(
        useCase.execute({
          tenantId: '',
          accountingMethod: AccountingMethod.Cash,
          costingMethod: CostingMethod.FIFO,
        })
      ).rejects.toThrow(InvalidOperationError);

      await expect(
        useCase.execute({
          tenantId: '   ',
          accountingMethod: AccountingMethod.Cash,
          costingMethod: CostingMethod.FIFO,
        })
      ).rejects.toThrow(InvalidOperationError);

      expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('should throw InvalidOperationError if accountingMethod is invalid', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(repositoryMock);

      await expect(
        useCase.execute({
          tenantId: 'tenant-4',
          accountingMethod: 'invalid-method' as AccountingMethod,
          costingMethod: CostingMethod.FIFO,
        })
      ).rejects.toThrow(InvalidOperationError);

      expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('should throw InvalidOperationError if costingMethod is invalid', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(repositoryMock);

      await expect(
        useCase.execute({
          tenantId: 'tenant-5',
          accountingMethod: AccountingMethod.Accrual,
          costingMethod: 'invalid-costing' as CostingMethod,
        })
      ).rejects.toThrow(InvalidOperationError);

      expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('should propagate errors thrown by the repository', async () => {
      const dbError = new Error('Database connection failed');
      repositoryMock.save.mockRejectedValue(dbError);

      const useCase = new SaveTenantAccountingConfigUseCase(repositoryMock);

      await expect(
        useCase.execute({
          tenantId: 'tenant-6',
          accountingMethod: AccountingMethod.Accrual,
          costingMethod: CostingMethod.FIFO,
        })
      ).rejects.toThrow('Database connection failed');

      expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    });
  });
});
