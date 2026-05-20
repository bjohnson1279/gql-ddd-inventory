import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { InventoryItemDTO } from '../dtos/InventoryItemDTO';
import { InventoryItemMapper } from '../dtos/InventoryItemMapper';

export class DispatchStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, amount: number): Promise<InventoryItemDTO> {
    const item = await this.inventoryRepository.findBySku(sku);
    
    if (!item) {
      throw new Error(`Item with SKU ${sku} not found.`);
    }

    const quantityToDispatch = new Quantity(amount);
    
    item.dispatchStock(quantityToDispatch);
    await this.inventoryRepository.save(item);

    return InventoryItemMapper.toDTO(item);
  }
}
