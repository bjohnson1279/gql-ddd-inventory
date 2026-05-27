import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { InventoryItemDTO } from '../dtos/InventoryItemDTO';
import { InventoryItemMapper } from '../dtos/InventoryItemMapper';
import { DomainEventDispatcher } from '../services/DomainEventDispatcher';

export class DispatchStockUseCase {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(sku: string, locationId: string, amount: number): Promise<InventoryItemDTO> {
    const item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    
    if (!item) {
      throw new Error(`Item with SKU ${sku} at location ${locationId} not found.`);
    }

    const quantityToDispatch = new Quantity(amount);
    
    item.dispatchStock(quantityToDispatch);
    await this.inventoryRepository.save(item);
    this.eventDispatcher.dispatch(item.pullDomainEvents());

    return InventoryItemMapper.toDTO(item);
  }
}
