import { IIntegrationRepository } from '../../domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../domain/integrations/enums/IntegrationEnums';
import { v4 as uuidv4 } from 'uuid';

export class GetWooCommerceConnectionsUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(tenantId: string): Promise<any[]> {
    const tId = new TenantId(tenantId);
    const connections = await this.integrationRepo.findAllByTenant(tId);
    return connections
      .filter(c => c.platform === IntegrationPlatform.WooCommerce)
      .map(c => ({
        id: c.id.value,
        tenantId: c.tenantId.value,
        platform: c.platform,
        storeUrl: c.storeDomain,
        isActive: c.isActive,
      }));
  }
}

export class ConnectWooCommerceStoreUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(params: { tenantId: string; storeUrl: string; consumerKey: string; consumerSecret: string }): Promise<boolean> {
    const connection = new IntegrationConnection(
      new IntegrationId(uuidv4()),
      new TenantId(params.tenantId),
      IntegrationPlatform.WooCommerce,
      params.storeUrl,
      params.consumerKey // Storing consumerKey as accessToken for scaffolding
    );
    await this.integrationRepo.save(connection);
    return true;
  }
}
