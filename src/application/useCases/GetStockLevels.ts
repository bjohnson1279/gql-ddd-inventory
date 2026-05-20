import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { InventoryItemDTO } from '../dtos/InventoryItemDTO';
import { InventoryItemMapper } from '../dtos/InventoryItemMapper';

export class GetStockLevelsUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(): Promise<InventoryItemDTO[]> {
    const items = await this.inventoryRepository.findAll();
    return items.map(InventoryItemMapper.toDTO);
  }
}

export class GetStockLevelBySkuUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string): Promise<InventoryItemDTO | null> {
    const item = await this.inventoryRepository.findBySku(sku);
    return item ? InventoryItemMapper.toDTO(item) : null;
  }
}
