import { CostingMethod, AccountingMethod } from '../../domain/enums/AccountingEnums';
import { PrismaClient } from '@prisma/client';

export interface TenantAccountingConfigDTO {
  tenantId: string;
  accountingMethod: AccountingMethod;
  costingMethod: CostingMethod;
}

// Cast prisma to any to access the tenantAccountingConfig model.
// This model is defined in schema.prisma and will be available after running
// `prisma migrate dev` or `prisma db push` to sync the schema.
function config(prisma: PrismaClient) {
  return (prisma as any).tenantAccountingConfig;
}

export class GetTenantAccountingConfigUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<TenantAccountingConfigDTO> {
    const row = await config(this.prisma).findUnique({ where: { tenantId } }) as {
      accountingMethod: string;
      costingMethod: string;
    } | null;

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
    await config(this.prisma).upsert({
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
