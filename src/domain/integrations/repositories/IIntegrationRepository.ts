import { IntegrationConnection } from '../aggregates/IntegrationConnection';
import { IntegrationId } from '../valueObjects/IntegrationId';
import { TenantId } from '../../valueObjects/TenantId';

export interface IIntegrationRepository {
  save(connection: IntegrationConnection): Promise<void>;
  findById(id: IntegrationId): Promise<IntegrationConnection | null>;
  findAllByTenant(tenantId: TenantId): Promise<IntegrationConnection[]>;
  findByStoreDomain(storeDomain: string): Promise<IntegrationConnection | null>;
}
