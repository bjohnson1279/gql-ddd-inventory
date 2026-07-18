import { CostingMethod, AccountingMethod } from '../../domain/enums/AccountingEnums';
import { ITenantAccountingConfigRepository } from '../../domain/repositories/ITenantAccountingConfigRepository';
import { InvalidOperationError } from '../../domain/exceptions/DomainErrors';

export interface TenantAccountingConfigDTO {
  tenantId: string;
  accountingMethod: AccountingMethod;
  costingMethod: CostingMethod;
}

export class GetTenantAccountingConfigUseCase {
  constructor(private readonly configRepo: ITenantAccountingConfigRepository) {}

  async execute(tenantId: string): Promise<TenantAccountingConfigDTO> {
    const config = await this.configRepo.findByTenantId(tenantId);

    if (!config) {
      return {
        tenantId,
        accountingMethod: AccountingMethod.Accrual,
        costingMethod: CostingMethod.FIFO,
      };
    }

    if (!Object.values(AccountingMethod).includes(config.accountingMethod)) {
      throw new InvalidOperationError(`Invalid accounting method found in database: ${config.accountingMethod}`);
    }

    if (!Object.values(CostingMethod).includes(config.costingMethod)) {
      throw new InvalidOperationError(`Invalid costing method found in database: ${config.costingMethod}`);
    }

    return config;
  }
}

export class SaveTenantAccountingConfigUseCase {
  constructor(private readonly configRepo: ITenantAccountingConfigRepository) {}

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

    await this.configRepo.save(input);
    return true;
  }
}
