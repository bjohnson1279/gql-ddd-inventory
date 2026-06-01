import { SubmitInventoryCountUseCase } from './src/application/useCases/SubmitInventoryCount';
import { DomainEventDispatcher } from './src/application/services/DomainEventDispatcher';
import { InventoryItem } from './src/domain/entities/InventoryItem';

class MockRepository {
    private items = new Map<string, InventoryItem>();

    async findBySkuAndLocation(sku: string, locationId: string): Promise<InventoryItem | null> {
        // Simulate DB read
        await new Promise(r => setTimeout(r, 2));
        for (const item of this.items.values()) {
            if (item.sku.value === sku && item.locationId.value === locationId) {
                return item;
            }
        }
        return null;
    }

    async save(item: InventoryItem): Promise<void> {
        // Simulate DB write
        await new Promise(r => setTimeout(r, 2));
        this.items.set(item.id, item);
    }
}

class MockEventBus {
    publish() { /* do nothing */ }
}

async function run() {
  const repo = new MockRepository() as any;
  const dispatcher = new DomainEventDispatcher(new MockEventBus() as any);
  // We mock a fake old execute method to simulate the old performance
  const oldExecute = async (counts: any[]) => {
      const results: any[] = [];
      for (const count of counts) {
          let item = await repo.findBySkuAndLocation(count.sku, count.locationId);
          if (!item) {
              const id = Math.random().toString(36).substring(2, 15);
              item = InventoryItem.createNew(id, count.sku, count.locationId);
          }
          await repo.save(item);
      }
      return results;
  };


  // Measure time
  const start = Date.now();

  const counts = [];
  for (let i = 0; i < 500; i++) {
    counts.push({
      sku: `SKU-${i}`,
      locationId: `LOC-1`,
      actualQuantity: 10
    });
  }

  // suppress console logs
  const originalLog = console.log;
  console.log = () => {};

  await oldExecute(counts);
  const end = Date.now();

  console.log = originalLog;
  console.log(`Time taken with old N+1 implementation: ${end - start} ms`);
}

run().catch(console.error);
