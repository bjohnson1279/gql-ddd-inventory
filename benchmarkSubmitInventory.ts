import { SubmitInventoryCountUseCase } from './src/application/useCases/SubmitInventoryCount';
import { InventoryItem } from './src/domain/entities/InventoryItem';
import { Sku } from './src/domain/valueObjects/Sku';
import { LocationId } from './src/domain/valueObjects/LocationId';
import { Quantity } from './src/domain/valueObjects/Quantity';
import { DomainEventDispatcher } from './src/application/services/DomainEventDispatcher';
import { IEventBus } from './src/domain/events/IEventBus';
import { CountItemInputDTO, CountResultDTO } from './src/application/dtos/SubmitInventoryCountDTO';

async function run() {
  const inventoryRepo = {
    findBySkuAndLocationBatch: async (pairs: any[]) => {
      await new Promise(resolve => setTimeout(resolve, 2));
      return pairs.map((p, i) => new InventoryItem(
        `id-${p.sku}`,
        new Sku(p.sku),
        new LocationId(p.locationId),
        new Quantity(10),
        1
      ));
    },
    saveBatch: async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
    }
  } as any;

  const eventBus: IEventBus = {
    publish: async () => {},
    subscribe: () => {}
  };

  const eventDispatcher = new DomainEventDispatcher(eventBus);
  const useCase = new SubmitInventoryCountUseCase(inventoryRepo, eventDispatcher as any);

  const numItems = 100;
  const counts = Array.from({ length: numItems }).map((_, i) => ({
    sku: `SKU${i}`,
    locationId: 'LOC1',
    actualQuantity: 15
  }));

  const start = Date.now();
  await useCase.execute(counts);
  const end = Date.now();
  console.log(`Execution time for ${numItems} items: ${end - start} ms`);
}

run().catch(console.error);
