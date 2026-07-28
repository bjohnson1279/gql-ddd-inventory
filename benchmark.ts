import { PostgresInventoryRepository } from './src/infrastructure/persistence/PostgresInventoryRepository';
import { InventoryItem } from './src/domain/entities/InventoryItem';
import { Sku } from './src/domain/valueObjects/Sku';
import { LocationId } from './src/domain/valueObjects/LocationId';
import { Quantity } from './src/domain/valueObjects/Quantity';

async function run() {
  let queries = 0;

  const mockTx = {
    inventoryItem: {
      create: async () => {
        queries++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return { id: 'mock-id' };
      },
      updateMany: async () => {
        queries++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return { count: 1 };
      },
      createMany: async () => {
        queries++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return { count: 1 };
      }
    },
    outboxEvent: {
      create: async () => {
        queries++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return { id: 'mock-event-id' };
      },
      createMany: async () => {
        queries++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return { count: 1 };
      }
    }
  };

  const prisma: any = {
    inventoryItem: {
      findMany: async () => {
        return [];
      }
    },
    $transaction: async (cb: any) => {
      return cb(mockTx);
    }
  };

  const repo = new PostgresInventoryRepository(prisma);

  const items: InventoryItem[] = [];
  for (let i = 0; i < 50; i++) {
    const item = new InventoryItem(
      `id-${i}`,
      new Sku(`SKU-${i}`),
      new LocationId(`LOC-${i}`),
      new Quantity(10),
      new Quantity(0),
      new Quantity(0),
      1
    );
    (item as any)._domainEvents.push({
      occurredOn: new Date(),
      itemId: `id-${i}`
    } as any);
    items.push(item);
  }

  console.log(`Starting benchmark with ${items.length} items...`);
  const start = Date.now();

  await repo.saveBatch(items);

  const end = Date.now();
  console.log(`Time: ${end - start}ms`);
  console.log(`Simulated queries: ${queries}`);
}

run().catch(console.error);
