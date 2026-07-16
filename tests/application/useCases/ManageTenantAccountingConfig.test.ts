import { PrismaClient } from '@prisma/client';
import {
  GetTenantAccountingConfigUseCase,
  SaveTenantAccountingConfigUseCase,
} from '../../../src/application/useCases/ManageTenantAccountingConfig';
import { AccountingMethod, CostingMethod } from '../../../src/domain/enums/AccountingEnums';
import { InvalidOperationError } from '../../../src/domain/exceptions/DomainErrors';

describe('ManageTenantAccountingConfig UseCases', () => {
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      tenantAccountingConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
  });

  describe('GetTenantAccountingConfigUseCase', () => {
    it('should return default config if none exists', async () => {
      prismaMock.tenantAccountingConfig.findUnique.mockResolvedValue(null);

      const useCase = new GetTenantAccountingConfigUseCase(prismaMock as PrismaClient);
      const result = await useCase.execute('tenant-1');

      expect(prismaMock.tenantAccountingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
      expect(result).toEqual({
        tenantId: 'tenant-1',
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: CostingMethod.FIFO,
      });
    });

    it('should return existing config', async () => {
      prismaMock.tenantAccountingConfig.findUnique.mockResolvedValue({
        accountingMethod: 'cash',
        costingMethod: 'lifo',
      });

      const useCase = new GetTenantAccountingConfigUseCase(prismaMock as PrismaClient);
      const result = await useCase.execute('tenant-2');

      expect(prismaMock.tenantAccountingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-2' },
      });
      expect(result).toEqual({
        tenantId: 'tenant-2',
        accountingMethod: AccountingMethod.Cash,
        costingMethod: CostingMethod.LIFO,
      });
    });

    it('should handle database errors when finding unique config', async () => {
      const dbError = new Error('Database connection failed');
      prismaMock.tenantAccountingConfig.findUnique.mockRejectedValue(dbError);

      const useCase = new GetTenantAccountingConfigUseCase(prismaMock as PrismaClient);

      await expect(useCase.execute('tenant-3')).rejects.toThrow('Database connection failed');
      expect(prismaMock.tenantAccountingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-3' },
      });
    });

    it('should gracefully handle empty string for tenantId', async () => {
      prismaMock.tenantAccountingConfig.findUnique.mockResolvedValue(null);

      const useCase = new GetTenantAccountingConfigUseCase(prismaMock as PrismaClient);
      const result = await useCase.execute('');

      expect(prismaMock.tenantAccountingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: '' },
      });
      expect(result).toEqual({
        tenantId: '',
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: CostingMethod.FIFO,
      });
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

      const useCase = new SaveTenantAccountingConfigUseCase(prismaMock as PrismaClient);
      const result = await useCase.execute({
        tenantId: 'tenant-3',
        accountingMethod: AccountingMethod.Cash,
        costingMethod: CostingMethod.WeightedAverageCost,
      });

      expect(prismaMock.tenantAccountingConfig.upsert).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-3' },
        create: {
          tenantId: 'tenant-3',
          accountingMethod: AccountingMethod.Cash,
          costingMethod: CostingMethod.WeightedAverageCost,
        },
        update: {
          accountingMethod: AccountingMethod.Cash,
          costingMethod: CostingMethod.WeightedAverageCost,
        },
      });
      expect(result).toBe(true);
    });

    it('should throw InvalidOperationError if tenantId is empty', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(prismaMock as PrismaClient);

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

      expect(prismaMock.tenantAccountingConfig.upsert).not.toHaveBeenCalled();
    });

    it('should throw InvalidOperationError if accountingMethod is invalid', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(prismaMock as PrismaClient);

      await expect(
        useCase.execute({
          tenantId: 'tenant-4',
          accountingMethod: 'invalid-method' as AccountingMethod,
          costingMethod: CostingMethod.FIFO,
        })
      ).rejects.toThrow(InvalidOperationError);

      expect(prismaMock.tenantAccountingConfig.upsert).not.toHaveBeenCalled();
    });

    it('should throw InvalidOperationError if costingMethod is invalid', async () => {
      const useCase = new SaveTenantAccountingConfigUseCase(prismaMock as PrismaClient);

      await expect(
        useCase.execute({
          tenantId: 'tenant-5',
          accountingMethod: AccountingMethod.Accrual,
          costingMethod: 'invalid-costing' as CostingMethod,
        })
      ).rejects.toThrow(InvalidOperationError);

      expect(prismaMock.tenantAccountingConfig.upsert).not.toHaveBeenCalled();
    });

    it('should propagate errors thrown by the database', async () => {
      const dbError = new Error('Database connection failed');
      prismaMock.tenantAccountingConfig.upsert.mockRejectedValue(dbError);

      const useCase = new SaveTenantAccountingConfigUseCase(prismaMock as PrismaClient);

      await expect(
        useCase.execute({
          tenantId: 'tenant-6',
          accountingMethod: AccountingMethod.Accrual,
          costingMethod: CostingMethod.FIFO,
        })
      ).rejects.toThrow('Database connection failed');

      expect(prismaMock.tenantAccountingConfig.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
