import { SyncInventoryToShopify } from './src/application/integrations/shopify/SyncInventoryToShopify';
import { IIntegrationRepository } from './src/domain/integrations/repositories/IIntegrationRepository';
import { IExternalMappingRepository } from './src/domain/integrations/repositories/IExternalMappingRepository';
import { ILedgerRepository } from './src/domain/repositories/ILedgerRepository';
import { IShopifyClient } from './src/domain/integrations/services/IShopifyClient';
import { IntegrationConnection } from './src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from './src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from './src/domain/valueObjects/TenantId';
import { IntegrationPlatform, ExternalEntityType } from './src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from './src/domain/integrations/entities/ExternalMapping';

async function runBenchmark() {
  const NUM_CONNECTIONS = 500;

  const integrationRepo = {
    save: async () => {},
    findById: async () => null,
    findAllByTenant: async () => {
      const connections = [];
      for (let i = 0; i < NUM_CONNECTIONS; i++) {
        connections.push(new IntegrationConnection(
          new IntegrationId(`I${i}`),
          new TenantId('T1'),
          IntegrationPlatform.Shopify,
          `test${i}.myshopify.com`,
          'token'
        ));
      }
      return connections;
    },
    findByStoreDomain: async () => null,
  } as unknown as IIntegrationRepository;

  const mappingRepo = {
    save: async () => {},
    findByInternalId: async (id: any, internalId: any, type: any) => {
      // Simulate DB delay
      await new Promise(resolve => setTimeout(resolve, 5));
      if (type === ExternalEntityType.Variant) {
        return new ExternalMapping(new TenantId('T1'), id, type, internalId, 'ext-v', 'ext-inv');
      }
      if (type === ExternalEntityType.Location) {
        return new ExternalMapping(new TenantId('T1'), id, type, internalId, 'ext-loc');
      }
      return null;
    },
    findManyByInternalId: async (ids: any[], internalId: any, type: any) => {
      // Simulate DB delay for batch query
      await new Promise(resolve => setTimeout(resolve, 5));
      return ids.map(id => {
        if (type === ExternalEntityType.Variant) {
          return new ExternalMapping(new TenantId('T1'), id, type, internalId, 'ext-v', 'ext-inv');
        }
        if (type === ExternalEntityType.Location) {
          return new ExternalMapping(new TenantId('T1'), id, type, internalId, 'ext-loc');
        }
      });
    },
    findByExternalId: async () => null,
    delete: async () => {},
  } as unknown as IExternalMappingRepository;

  const ledgerRepo = {
    append: async () => {},
    currentQuantity: async () => 10,
    entriesFor: async () => [],
    hasAnyEntries: async () => false,
  } as unknown as ILedgerRepository;

  const shopifyClient = {
    setInventory: async () => {
      // simulate API delay
      // await new Promise(resolve => setTimeout(resolve, 1));
    },
    upsertProduct: async () => null,
    getInventoryLevels: async () => [],
  } as unknown as IShopifyClient;

  const useCase = new SyncInventoryToShopify(integrationRepo, mappingRepo, ledgerRepo, shopifyClient);

  console.time('SyncInventoryToShopify');
  await useCase.execute('T1', 'L1', 'V1');
  console.timeEnd('SyncInventoryToShopify');
}

runBenchmark().catch(console.error);
