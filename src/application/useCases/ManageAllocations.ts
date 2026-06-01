import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { InventoryItemDTO } from '../dtos/InventoryItemDTO';
import { InventoryItemMapper } from '../dtos/InventoryItemMapper';

export class AllocateStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, locationId: string, amount: number): Promise<InventoryItemDTO> {
    const quantity = new Quantity(amount);
    let item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    if (!item) {
      const id = Math.random().toString(36).substring(2, 15);
      item = InventoryItem.createNew(id, sku, locationId);
    }

    item.allocateStock(quantity);
    await this.inventoryRepository.save(item);
    return InventoryItemMapper.toDTO(item);
  }
}

export class ReleaseAllocationUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, locationId: string, amount: number): Promise<InventoryItemDTO> {
    const quantity = new Quantity(amount);
    const item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    if (!item) {
      throw new Error(`Inventory item for SKU ${sku} at location ${locationId} not found.`);
    }

    item.releaseAllocation(quantity);
    await this.inventoryRepository.save(item);
    return InventoryItemMapper.toDTO(item);
  }
}

export class FulfillAllocationUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, locationId: string, amount: number): Promise<InventoryItemDTO> {
    const quantity = new Quantity(amount);
    const item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    if (!item) {
      throw new Error(`Inventory item for SKU ${sku} at location ${locationId} not found.`);
    }

    item.fulfillAllocation(quantity);
    await this.inventoryRepository.save(item);
    return InventoryItemMapper.toDTO(item);
  }
}

export class CreateInTransitUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, locationId: string, amount: number): Promise<InventoryItemDTO> {
    const quantity = new Quantity(amount);
    let item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    if (!item) {
      const id = Math.random().toString(36).substring(2, 15);
      item = InventoryItem.createNew(id, sku, locationId);
    }

    item.createInTransit(quantity);
    await this.inventoryRepository.save(item);
    return InventoryItemMapper.toDTO(item);
  }
}

export class ReceiveInTransitUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string, locationId: string, amount: number): Promise<InventoryItemDTO> {
    const quantity = new Quantity(amount);
    const item = await this.inventoryRepository.findBySkuAndLocation(sku, locationId);
    if (!item) {
      throw new Error(`Inventory item for SKU ${sku} at location ${locationId} not found.`);
    }

    item.receiveInTransit(quantity);
    await this.inventoryRepository.save(item);
    return InventoryItemMapper.toDTO(item);
  }
}
