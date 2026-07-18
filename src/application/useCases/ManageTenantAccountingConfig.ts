import { CostingMethod, AccountingMethod } from '../../domain/enums/AccountingEnums';
import { PrismaClient } from '@prisma/client';
import { InvalidOperationError } from '../../domain/exceptions/DomainErrors';

export interface TenantAccountingConfigDTO {
  tenantId: string;
  accountingMethod: AccountingMethod;
  costingMethod: CostingMethod;
}

export class GetTenantAccountingConfigUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<TenantAccountingConfigDTO> {
    const row = await this.prisma.tenantAccountingConfig.findUnique({ where: { tenantId } });

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
    if (!input) {
      throw new InvalidOperationError('Input is required');
    }

    if (!input.tenantId || input.tenantId.trim() === '') {
      throw new InvalidOperationError('tenantId is required');
    }

    if (!Object.values(AccountingMethod).includes(input.accountingMethod)) {
      throw new InvalidOperationError(`Invalid accounting method: ${input.accountingMethod}`);
    }

    if (!Object.values(CostingMethod).includes(input.costingMethod)) {
      throw new InvalidOperationError(`Invalid costing method: ${input.costingMethod}`);
    }

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
