import { SyncInventoryToShopify } from '../../../../src/application/integrations/shopify/SyncInventoryToShopify';
import { IIntegrationRepository } from '../../../../src/domain/integrations/repositories/IIntegrationRepository';
import { IExternalMappingRepository } from '../../../../src/domain/integrations/repositories/IExternalMappingRepository';
import { ILedgerRepository } from '../../../../src/domain/repositories/ILedgerRepository';
import { IShopifyClient } from '../../../../src/domain/integrations/services/IShopifyClient';
import { IntegrationConnection } from '../../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform, ExternalEntityType } from '../../../../src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from '../../../../src/domain/integrations/entities/ExternalMapping';

async function runBenchmark() {
  const integrationRepo = {
    save: async () => {},
    findById: async () => null,
    findAllByTenant: async () => [],
    findByStoreDomain: async () => null,
  } as unknown as IIntegrationRepository;

  let queries = 0;

  const mappingRepo = {
    save: async () => {},
    findByInternalId: async (id: any, internalId: any, type: any) => {
      queries++;
      return new ExternalMapping(new TenantId('T1'), id, type, internalId, `ext-${internalId}`, `ext-sec-${internalId}`);
    },
    findManyByInternalId: async (ids: IntegrationId[], internalId: any, type: any) => {
      queries++;
      return ids.map(id => new ExternalMapping(new TenantId('T1'), id, type, internalId, `ext-${internalId}`, `ext-sec-${internalId}`));
    },
    findByExternalId: async () => null,
    findByExternalIds: async () => [],
    delete: async () => {},
  } as unknown as IExternalMappingRepository;

  const ledgerRepo = {
    append: async () => {},
    currentQuantity: async () => 10,
    currentQuantities: async () => ({}),
    entriesFor: async () => [],
    hasAnyEntries: async () => false,
  } as unknown as ILedgerRepository;

  const shopifyClient = {
    setInventory: async () => {},
    upsertProduct: async () => ({}),
    getInventoryLevels: async () => [],
  } as unknown as IShopifyClient;

  const useCase = new SyncInventoryToShopify(integrationRepo, mappingRepo, ledgerRepo, shopifyClient);

  const numConnections = 1000;
  const connections: IntegrationConnection[] = [];
  for (let i = 0; i < numConnections; i++) {
    connections.push(new IntegrationConnection(
      new IntegrationId(`I${i}`),
      new TenantId('T1'),
      IntegrationPlatform.Shopify,
      `test${i}.myshopify.com`,
      'token'
    ));
  }

  integrationRepo.findAllByTenant = async () => connections;

  const start = Date.now();
  await useCase.execute('T1', 'L1', 'V1');
  const end = Date.now();

  console.log(`Execution time for ${numConnections} connections: ${end - start}ms`);
  console.log(`Number of queries: ${queries}`);
}

runBenchmark().catch(console.error);
