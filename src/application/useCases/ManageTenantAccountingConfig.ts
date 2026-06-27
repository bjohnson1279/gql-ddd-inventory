import { CostingMethod, AccountingMethod } from '../../domain/enums/AccountingEnums';
import { PrismaClient } from '@prisma/client';

export interface TenantAccountingConfigDTO {
  tenantId: string;
  accountingMethod: AccountingMethod;
  costingMethod: CostingMethod;
}

export class GetTenantAccountingConfigUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<TenantAccountingConfigDTO> {
    const row = await this.prisma.tenantAccountingConfig.findUnique({
      where: { tenantId },
    });

    if (!row) {
      return {
        tenantId,
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: CostingMethod.FIFO,
      };
    }

    return {
      tenantId,
      accountingMethod: row.accountingMethod as AccountingMethod,
      costingMethod: row.costingMethod as CostingMethod,
    };
  }
}

export class SaveTenantAccountingConfigUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: TenantAccountingConfigDTO): Promise<boolean> {
    await this.prisma.tenantAccountingConfig.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        accountingMethod: input.accountingMethod,
        costingMethod: input.costingMethod,
      },
      update: {
        accountingMethod: input.accountingMethod,
        costingMethod: input.costingMethod,
      },
    });
    return true;
  }
}
