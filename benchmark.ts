import { SubmitInventoryCountUseCase } from './src/application/useCases/SubmitInventoryCount';
import { DomainEventDispatcher } from './src/application/services/DomainEventDispatcher';
import { InventoryItem } from './src/domain/entities/InventoryItem';

class MockRepository {
    private items = new Map<string, InventoryItem>();

    async findBySkusAndLocations(pairs: { sku: string; locationId: string }[]): Promise<InventoryItem[]> {
        // Simulate DB read latency (e.g., 20ms)
        await new Promise(r => setTimeout(r, 20));
        return Array.from(this.items.values())
            .filter(item =>
                pairs.some(p => p.sku === item.sku.value && p.locationId === item.locationId.value)
            );
    }

    async saveBatch(items: InventoryItem[]): Promise<void> {
        // Simulate DB write latency (e.g., 20ms per batch)
        await new Promise(r => setTimeout(r, 20));
        for (const item of items) {
            this.items.set(item.id, item);
        }
    }
}

class MockEventBus {
    publish() { /* do nothing */ }
}

async function run() {
  const repo = new MockRepository() as any;
  const dispatcher = new DomainEventDispatcher(new MockEventBus() as any);
  const useCase = new SubmitInventoryCountUseCase(repo, dispatcher);

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

  await useCase.execute(counts);
  const end = Date.now();

  console.log = originalLog;
  console.log(`Time taken with new bulk implementation: ${end - start} ms`);
}

run().catch(console.error);
