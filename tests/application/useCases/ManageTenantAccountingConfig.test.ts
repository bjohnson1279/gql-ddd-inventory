import { PrismaClient } from '@prisma/client';
import {
  GetTenantAccountingConfigUseCase,
  SaveTenantAccountingConfigUseCase,
} from '../../../src/application/useCases/ManageTenantAccountingConfig';
import { AccountingMethod, CostingMethod } from '../../../src/domain/enums/AccountingEnums';

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
  });
});
