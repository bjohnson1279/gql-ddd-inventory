import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { CountItemInputDTO, CountResultDTO } from '../dtos/SubmitInventoryCountDTO';

export class SubmitInventoryCountUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(counts: CountItemInputDTO[]): Promise<CountResultDTO[]> {
    const results: CountResultDTO[] = [];

    for (const count of counts) {
      let item = await this.inventoryRepository.findBySku(count.sku);

      // If the item doesn't exist yet, we can create it as part of the count,
      // or throw an error. For a full inventory count, it's common to discover new SKUs.
      if (!item) {
        const id = Math.random().toString(36).substring(2, 15);
        item = InventoryItem.createNew(id, count.sku);
      }

      const actualQty = new Quantity(count.actualQuantity);
      const reconciliationResult = item.reconcileStock(actualQty);
      
      await this.inventoryRepository.save(item);

      results.push({
        sku: count.sku,
        ...reconciliationResult
      });
    }

    return results;
  }
}
