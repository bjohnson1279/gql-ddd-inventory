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

export class GetStockLevelsBySkuUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string): Promise<InventoryItemDTO[]> {
    const items = await this.inventoryRepository.findBySku(sku);
    return items.map(InventoryItemMapper.toDTO);
  }
}

export class GetStockLevelBySkuAndLocationUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, locationId: string): Promise<InventoryItemDTO | null> {
    const item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    return item ? InventoryItemMapper.toDTO(item) : null;
  }
}
