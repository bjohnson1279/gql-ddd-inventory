import { PostgresInventoryRepository } from '../src/infrastructure/persistence/PostgresInventoryRepository';
import { InventoryItem } from '../src/domain/entities/InventoryItem';
import { Quantity } from '../src/domain/valueObjects/Quantity';

async function run() {
  const batchSize = 1000;

  // We simulate delays to mock db round trips to show the true N+1 issue
  let createCalls = 0;
  let updateManyCalls = 0;
  let outboxCreateCalls = 0;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const DB_LATENCY_MS = 2; // 2ms per query

  const prismaMock: any = {
    inventoryItem: {
      findMany: async () => { await delay(DB_LATENCY_MS); return []; },
      create: async () => { createCalls++; await delay(DB_LATENCY_MS); return {}; },
      updateMany: async () => { updateManyCalls++; await delay(DB_LATENCY_MS); return { count: 1 }; },
      createMany: async () => { await delay(DB_LATENCY_MS); return { count: 1000 }; }
    },
    outboxEvent: {
      create: async () => { outboxCreateCalls++; await delay(DB_LATENCY_MS); return {}; },
      createMany: async () => { await delay(DB_LATENCY_MS); return { count: 1000 }; }
    },
    $transaction: async (cb: any) => cb(prismaMock)
  };

  const repo = new PostgresInventoryRepository(prismaMock);

  const items: InventoryItem[] = [];
  for (let i = 0; i < batchSize; i++) {
    const item = InventoryItem.createNew(`item-bench-${i}`, `SKU-BENCH-${i}`, 'loc-1');
    item.receiveStock(new Quantity(10)); // This pushes a domain event (LowStockAlertEvent if < 10 but here it's 10, wait let's see if 10 pushes event. Actually createNew sets 0. receiveStock 10. Wait.)
    items.push(item);
  }

  const startInsert = Date.now();
  await repo.saveBatch(items);
  const endInsert = Date.now();
  console.log(`Baseline Insert batch of ${batchSize} took ${endInsert - startInsert}ms`);

  // Simulate all items existing for the update path
  prismaMock.inventoryItem.findMany = async () => { await delay(DB_LATENCY_MS); return items.map(i => ({ id: i.id })); };

  for (const item of items) {
    item.dispatchStock(new Quantity(2));
  }

  const startUpdate = Date.now();
  await repo.saveBatch(items);
  const endUpdate = Date.now();
  console.log(`Baseline Update batch of ${batchSize} took ${endUpdate - startUpdate}ms`);
}

run().catch(console.error);
