import { ProcessShopifyOrder } from './src/application/integrations/shopify/ProcessShopifyOrder';
import { IntegrationConnection } from './src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from './src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from './src/domain/valueObjects/TenantId';
import { IntegrationPlatform, ExternalEntityType } from './src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from './src/domain/integrations/entities/ExternalMapping';

async function run() {
  const integrationRepo = {
    save: async () => {},
    findById: async () => new IntegrationConnection(new IntegrationId('I1'), new TenantId('T1'), IntegrationPlatform.Shopify, 'test.myshopify.com', 'token'),
    findAllByTenant: async () => [],
    findByStoreDomain: async () => null,
  };

  const mappingRepo = {
    save: async () => {},
    findByInternalId: async () => null,
    findByExternalId: async (id: any, externalId: string, type: any) => {
      // Simulate DB delay
      await new Promise(resolve => setTimeout(resolve, 2));
      if (type === ExternalEntityType.Location && externalId === 'ext-loc') {
        return new ExternalMapping(new TenantId('T1'), id, type, 'int-loc', externalId);
      }
      if (type === ExternalEntityType.Variant) {
        return new ExternalMapping(new TenantId('T1'), id, type, `int-${externalId}`, externalId);
      }
      return null;
    },
    findByExternalIds: async (id: any, externalIds: string[], type: any) => {
      await new Promise(resolve => setTimeout(resolve, 2));
      return externalIds.map(extId => new ExternalMapping(new TenantId('T1'), id, type, `int-${extId}`, extId));
    },
    delete: async () => {},
  };

  const inventoryService = {
    decrementForSale: async () => {},
    decrementForKitSale: async () => {},
  } as any;

  const useCase = new ProcessShopifyOrder(integrationRepo, mappingRepo, inventoryService);

  const numItems = 100;
  const lineItems = Array.from({ length: numItems }).map((_, i) => ({
    shopifyVariantId: `ext-v${i}`,
    quantity: 1
  }));

  const start = Date.now();
  await useCase.execute({
    integrationId: 'I1',
    shopifyOrderId: '1001',
    shopifyLocationId: 'ext-loc',
    lineItems
  });
  const end = Date.now();
  console.log(`Execution time for ${numItems} items: ${end - start} ms`);
}

run().catch(console.error);
