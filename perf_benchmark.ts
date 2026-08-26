import { SyncProductFromShopify } from './src/application/integrations/shopify/SyncProductFromShopify';
import { ShopifyProductData } from './src/domain/integrations/services/IShopifyClient';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MockProductRepo {
  async findById() { return null; }
  async save() { await delay(1); } // simulate small DB save time
  async delete() {}
  async findByTenantId() { return []; }
  async findBySku() { return null; }
  async findAll() { return []; }
}

class MockMappingRepo {
  async save() { await delay(1); }
  async saveBatch(mappings: any[]) {
    await delay(5); // Simulate batch DB save latency
  }
  async findByInternalId() { return null; }
  async findByExternalId() {
    await delay(5); // Simulate DB query latency
    return null;
  }
  async findByExternalIds() {
    await delay(5); // Simulate DB query latency for batch query
    return [];
  }
  async delete() {}
}

async function runBenchmark() {
  const productRepo = new MockProductRepo();
  const mappingRepo = new MockMappingRepo();

  const sync = new SyncProductFromShopify(productRepo as any, mappingRepo as any);

  const variants = Array.from({ length: 100 }).map((_, i) => ({
    id: `v${i}`,
    sku: `SKU-${i}`,
    inventoryItemId: `inv${i}`,
    title: `Variant ${i}`
  }));

  const productData: ShopifyProductData = {
    id: 'p1',
    title: 'Product 1',
    variants
  };

  console.log(`Starting benchmark with ${variants.length} variants...`);

  const start = Date.now();
  await sync.execute('int-1', 'tenant-1', productData);
  const end = Date.now();

  console.log(`Execution time: ${end - start} ms`);
}

runBenchmark().catch(console.error);
