import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { InventoryItemDTO } from '../dtos/InventoryItemDTO';
import { InventoryItemMapper } from '../dtos/InventoryItemMapper';

export class ReceiveStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, amount: number): Promise<InventoryItemDTO> {
    const quantity = new Quantity(amount);
    
    let item = await this.inventoryRepository.findBySku(sku);
    
    if (!item) {
      const id = Math.random().toString(36).substring(2, 15);
      item = InventoryItem.createNew(id, sku);
    }

    item.receiveStock(quantity);
    await this.inventoryRepository.save(item);

    return InventoryItemMapper.toDTO(item);
  }
}
