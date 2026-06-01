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
    const itemsToSave: InventoryItem[] = [];

    // Extract unique sku-locationId pairs
    const pairs = counts.map(c => ({ sku: c.sku, locationId: c.locationId }));

    // Bulk load items
    const existingItems = await this.inventoryRepository.findBySkusAndLocations(pairs);
    const itemMap = new Map<string, InventoryItem>();

    for (const item of existingItems) {
      itemMap.set(`${item.sku.value}::${item.locationId.value}`, item);
    }

    for (const count of counts) {
      const key = `${count.sku}::${count.locationId}`;
      let item = itemMap.get(key);

      // If the item doesn't exist yet, we can create it as part of the count,
      // or throw an error. For a full inventory count, it's common to discover new SKUs.
      if (!item) {
        const id = Math.random().toString(36).substring(2, 15);
        item = InventoryItem.createNew(id, count.sku, count.locationId);
        itemMap.set(key, item); // Store it back to prevent duplicate creations
      }

      const actualQty = new Quantity(count.actualQuantity);
      const reconciliationResult = item.reconcileStock(actualQty);
      
      // Ensure we don't push duplicates if multiple counts for same item
      if (!itemsToSave.includes(item)) {
          itemsToSave.push(item);
      }

      results.push({
        sku: count.sku,
        locationId: count.locationId,
        ...reconciliationResult
      });
    }

    // Bulk save items
    await this.inventoryRepository.saveBatch(itemsToSave);

    // Dispatch events only after successful save
    for (const item of itemsToSave) {
      this.eventDispatcher.dispatch(item.pullDomainEvents());
    }

    return results;
  }
}
