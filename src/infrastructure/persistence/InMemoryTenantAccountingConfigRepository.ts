import { ITenantAccountingConfigRepository } from '../../domain/repositories/ITenantAccountingConfigRepository';
import { TenantAccountingConfigDTO } from '../../application/useCases/ManageTenantAccountingConfig';

export class InMemoryTenantAccountingConfigRepository implements ITenantAccountingConfigRepository {
  private readonly configs = new Map<string, TenantAccountingConfigDTO>();

  async findByTenantId(tenantId: string): Promise<TenantAccountingConfigDTO | null> {
    const config = this.configs.get(tenantId);
    if (!config) return null;
    return { ...config };
  }

  async save(config: TenantAccountingConfigDTO): Promise<void> {
    this.configs.set(config.tenantId, { ...config });
  }
}
