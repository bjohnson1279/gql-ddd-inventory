import { IIntegrationRepository } from '../../domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../domain/integrations/enums/IntegrationEnums';
import crypto from 'node:crypto';
const uuidv4 = () => crypto.randomUUID();

export class GetAmazonConnectionsUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(tenantId: string): Promise<any[]> {
    const tId = new TenantId(tenantId);
    const connections = await this.integrationRepo.findAllByTenant(tId);
    return connections
      .filter(c => c.platform === IntegrationPlatform.Amazon)
      .map(c => ({
        id: c.id.value,
        tenantId: c.tenantId.value,
        platform: c.platform,
        sellerId: c.storeDomain, // mapping storeDomain to sellerId internally for now
        marketplaceId: c.accessToken, // mapping accessToken to marketplaceId for now
        isActive: c.isActive,
      }));
  }
}

export class ConnectAmazonStoreUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(params: { tenantId: string; sellerId: string; mwsAuthToken: string; marketplaceId: string }): Promise<boolean> {
    const connection = new IntegrationConnection(
      new IntegrationId(uuidv4()),
      new TenantId(params.tenantId),
      IntegrationPlatform.Amazon,
      params.sellerId,
      params.marketplaceId // Using token field for marketplaceId just for scaffolding
    );
    await this.integrationRepo.save(connection);
    return true;
  }
}
