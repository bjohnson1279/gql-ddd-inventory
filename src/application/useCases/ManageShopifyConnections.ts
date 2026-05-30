import { IIntegrationRepository } from '../../domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../domain/integrations/enums/IntegrationEnums';

export class ConnectShopifyStoreUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(input: {
    id: string;
    tenantId: string;
    storeDomain: string;
    accessToken: string;
  }): Promise<boolean> {
    const connection = new IntegrationConnection(
      new IntegrationId(input.id),
      new TenantId(input.tenantId),
      IntegrationPlatform.Shopify,
      input.storeDomain,
      input.accessToken
    );
    await this.integrationRepo.save(connection);
    return true;
  }
}

export class GetShopifyConnectionsUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(tenantId: string): Promise<IntegrationConnection[]> {
    return await this.integrationRepo.findAllByTenant(new TenantId(tenantId));
  }
}
