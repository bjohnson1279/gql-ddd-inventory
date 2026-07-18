import { TenantAccountingConfigDTO } from '../../application/useCases/ManageTenantAccountingConfig';

export interface ITenantAccountingConfigRepository {
  findByTenantId(tenantId: string): Promise<TenantAccountingConfigDTO | null>;
  save(config: TenantAccountingConfigDTO): Promise<void>;
}
