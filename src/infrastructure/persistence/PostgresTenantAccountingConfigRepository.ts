import { PrismaClient } from '@prisma/client';
import { ITenantAccountingConfigRepository } from '../../domain/repositories/ITenantAccountingConfigRepository';
import { TenantAccountingConfigDTO } from '../../application/useCases/ManageTenantAccountingConfig';
import { AccountingMethod, CostingMethod } from '../../domain/enums/AccountingEnums';

export class PostgresTenantAccountingConfigRepository implements ITenantAccountingConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantId(tenantId: string): Promise<TenantAccountingConfigDTO | null> {
    const row = await this.prisma.tenantAccountingConfig.findUnique({ where: { tenantId } });
    if (!row) return null;

    return {
      tenantId: row.tenantId,
      accountingMethod: row.accountingMethod as AccountingMethod,
      costingMethod: row.costingMethod as CostingMethod,
    };
  }

  async save(config: TenantAccountingConfigDTO): Promise<void> {
    await this.prisma.tenantAccountingConfig.upsert({
      where: { tenantId: config.tenantId },
      create: {
        tenantId: config.tenantId,
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
      },
      update: {
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
      },
    });
  }
}
