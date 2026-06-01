import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { CountItemInputDTO, CountResultDTO } from '../dtos/SubmitInventoryCountDTO';
import { DomainEventDispatcher } from '../services/DomainEventDispatcher';

export class SubmitInventoryCountUseCase {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(counts: CountItemInputDTO[]): Promise<CountResultDTO[]> {
    const results: CountResultDTO[] = [];

    for (const count of counts) {
      let item = await this.inventoryRepository.findBySkuAndLocation(count.sku, count.locationId);

      // If the item doesn't exist yet, we can create it as part of the count,
      // or throw an error. For a full inventory count, it's common to discover new SKUs.
      if (!item) {
        const id = Math.random().toString(36).substring(2, 15);
        item = InventoryItem.createNew(id, count.sku, count.locationId);
      }

      const actualQty = new Quantity(count.actualQuantity);
      const reconciliationResult = item.reconcileStock(actualQty);
      
      await this.inventoryRepository.save(item);
      this.eventDispatcher.dispatch(item.pullDomainEvents());

      results.push({
        sku: count.sku,
        locationId: count.locationId,
        ...reconciliationResult
      });
    }

    return results;
  }
}
