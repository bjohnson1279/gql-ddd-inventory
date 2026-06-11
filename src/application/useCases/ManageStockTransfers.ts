import crypto from 'crypto';
import { StockTransfer } from '../../domain/entities/StockTransfer';
import { StockTransferId } from '../../domain/valueObjects/StockTransferId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { StockTransferItem } from '../../domain/valueObjects/StockTransferItem';
import { StockTransferStatus } from '../../domain/enums/StockTransferStatus';
import { IStockTransferRepository } from '../../domain/repositories/IStockTransferRepository';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { Sku } from '../../domain/valueObjects/Sku';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { ReasonCode } from '../../domain/enums/ReasonCode';
import { appendStockLedgerEntries } from '../../infrastructure/utils/ledgerEntryUtils';
import { InventoryItem } from '../../domain/entities/InventoryItem';

export interface StockTransferDTO {
  id: string;
  tenantId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  status: string;
  items: { variantId: string; quantity: number }[];
  referenceId: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

function toDTO(transfer: StockTransfer): StockTransferDTO {
  return {
    id: transfer.id.value,
    tenantId: transfer.tenantId.value,
    sourceLocationId: transfer.sourceLocationId.value,
    destinationLocationId: transfer.destinationLocationId.value,
    status: transfer.status,
    items: transfer.items.map((item) => ({
      variantId: item.variantId.value,
      quantity: item.quantity,
    })),
    referenceId: transfer.referenceId,
    dispatchedAt: transfer.dispatchedAt ? transfer.dispatchedAt.toISOString() : null,
    receivedAt: transfer.receivedAt ? transfer.receivedAt.toISOString() : null,
    createdAt: transfer.createdAt.toISOString(),
  };
}

export class CreateStockTransferUseCase {
  constructor(private readonly transferRepo: IStockTransferRepository) {}

  async execute(input: {
    tenantId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    items: { variantId: string; quantity: number }[];
    referenceId?: string;
  }): Promise<StockTransferDTO> {
    const id = new StockTransferId(crypto.randomUUID());
    const tenantId = new TenantId(input.tenantId);
    const sourceLoc = new LocationId(input.sourceLocationId);
    const destLoc = new LocationId(input.destinationLocationId);
    const transferItems = input.items.map(
      (item) => new StockTransferItem(new ProductVariantId(item.variantId), item.quantity)
    );

    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, transferItems, input.referenceId);
    await this.transferRepo.save(transfer);
    return toDTO(transfer);
  }
}

export class DispatchStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository
  ) {}

  async execute(transferId: string, actorId: string, tenantId: string): Promise<StockTransferDTO> {
    const id = new StockTransferId(transferId);
    const transfer = await this.transferRepo.findById(id);
    if (!transfer) {
      throw new Error(`Stock transfer ${transferId} not found.`);
    }

    transfer.dispatch();

    // Batch operations to fix N+1 query
    const variantIds = transfer.items.map(i => i.variantId.value);
    const variantSkus = await this.productRepo.findSkusByVariantIds(variantIds);

    const sourcePairs = transfer.items.map(item => {
      const sku = variantSkus.get(item.variantId.value);
      if (!sku) throw new Error(`Sku not found for variant ID: ${item.variantId.value}`);
      return { sku, locationId: transfer.sourceLocationId.value };
    });

    const destPairs = transfer.items.map(item => {
      const sku = variantSkus.get(item.variantId.value);
      if (!sku) throw new Error(`Sku not found for variant ID: ${item.variantId.value}`);
      return { sku, locationId: transfer.destinationLocationId.value };
    });

    const [sourceItemsList, destItemsList] = await Promise.all([
      this.inventoryRepo.findBySkuAndLocationBatch(sourcePairs),
      this.inventoryRepo.findBySkuAndLocationBatch(destPairs),
    ]);

    const sourceItemsMap = new Map(sourceItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));
    const destItemsMap = new Map(destItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));

    const itemsToSave: InventoryItem[] = [];
    const ledgerEntriesData: { sku: string; locationId: string; quantity: number }[] = [];

    // Perform stock decrements at source and set inTransit at destination
    for (const item of transfer.items) {
      const sku = variantSkus.get(item.variantId.value)!;

      // 1. Deduct from source warehouse
      const sourceKey = `${sku}_${transfer.sourceLocationId.value}`;
      let sourceItem = sourceItemsMap.get(sourceKey);
      if (!sourceItem) {
        throw new Error(`Inventory item for SKU ${sku} at source location ${transfer.sourceLocationId.value} not found.`);
      }
      sourceItem.dispatchStock(new Quantity(item.quantity));
      if (!itemsToSave.includes(sourceItem)) {
        itemsToSave.push(sourceItem);
      }

      // Append to ledger at source (negative decrement)
      ledgerEntriesData.push({ sku, locationId: transfer.sourceLocationId.value, quantity: -item.quantity });

      // 2. Add as in-transit to destination warehouse
      const destKey = `${sku}_${transfer.destinationLocationId.value}`;
      let destItem = destItemsMap.get(destKey);
      if (!destItem) {
        destItem = InventoryItem.createNew(crypto.randomUUID(), sku, transfer.destinationLocationId.value);
        destItemsMap.set(destKey, destItem);
      }
      destItem.createInTransit(new Quantity(item.quantity));
      if (!itemsToSave.includes(destItem)) {
        itemsToSave.push(destItem);
      }
    }

    await this.inventoryRepo.saveBatch(itemsToSave);

    await appendStockLedgerEntries(
      this.productRepo,
      this.ledgerRepo,
      ledgerEntriesData,
      ReasonCode.Transfer,
      { auth: { tenantId, actorId } }
    );

    await this.transferRepo.save(transfer);
    return toDTO(transfer);
  }
}

export class ReceiveStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository
  ) {}

  async execute(transferId: string, actorId: string, tenantId: string): Promise<StockTransferDTO> {
    const id = new StockTransferId(transferId);
    const transfer = await this.transferRepo.findById(id);
    if (!transfer) {
      throw new Error(`Stock transfer ${transferId} not found.`);
    }

    transfer.receive();

    // Batch operations to fix N+1 query
    const variantIds = transfer.items.map(i => i.variantId.value);
    const variantSkus = await this.productRepo.findSkusByVariantIds(variantIds);

    const destPairs = transfer.items.map(item => {
      const sku = variantSkus.get(item.variantId.value);
      if (!sku) throw new Error(`Sku not found for variant ID: ${item.variantId.value}`);
      return { sku, locationId: transfer.destinationLocationId.value };
    });

    const destItemsList = await this.inventoryRepo.findBySkuAndLocationBatch(destPairs);
    const destItemsMap = new Map(destItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));

    const itemsToSave: InventoryItem[] = [];
    const ledgerEntriesData: { sku: string; locationId: string; quantity: number }[] = [];

    // Receive stock at destination location
    for (const item of transfer.items) {
      const sku = variantSkus.get(item.variantId.value)!;
      const key = `${sku}_${transfer.destinationLocationId.value}`;

      let destItem = destItemsMap.get(key);
      if (!destItem) {
        throw new Error(`Inventory item for SKU ${sku} at destination location ${transfer.destinationLocationId.value} not found.`);
      }

      destItem.receiveInTransit(new Quantity(item.quantity));
      if (!itemsToSave.includes(destItem)) {
        itemsToSave.push(destItem);
      }

      // Append ledger entry at destination (positive receipt)
      ledgerEntriesData.push({ sku, locationId: transfer.destinationLocationId.value, quantity: item.quantity });
    }

    await this.inventoryRepo.saveBatch(itemsToSave);

    await appendStockLedgerEntries(
      this.productRepo,
      this.ledgerRepo,
      ledgerEntriesData,
      ReasonCode.Transfer,
      { auth: { tenantId, actorId } }
    );

    await this.transferRepo.save(transfer);
    return toDTO(transfer);
  }
}

export class CancelStockTransferUseCase {
  constructor(
    private readonly transferRepo: IStockTransferRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository
  ) {}

  async execute(transferId: string, actorId: string, tenantId: string): Promise<StockTransferDTO> {
    const id = new StockTransferId(transferId);
    const transfer = await this.transferRepo.findById(id);
    if (!transfer) {
      throw new Error(`Stock transfer ${transferId} not found.`);
    }

    const previousStatus = transfer.status;
    transfer.cancel();

    // If it was already dispatched, we must reverse the stock adjustments
    if (previousStatus === StockTransferStatus.Dispatched) {
      // Batch operations to fix N+1 query
      const variantIds = transfer.items.map(i => i.variantId.value);
      const variantSkus = await this.productRepo.findSkusByVariantIds(variantIds);

      const sourcePairs = transfer.items.map(item => {
        const sku = variantSkus.get(item.variantId.value);
        if (!sku) throw new Error(`Sku not found for variant ID: ${item.variantId.value}`);
        return { sku, locationId: transfer.sourceLocationId.value };
      });

      const destPairs = transfer.items.map(item => {
        const sku = variantSkus.get(item.variantId.value);
        if (!sku) throw new Error(`Sku not found for variant ID: ${item.variantId.value}`);
        return { sku, locationId: transfer.destinationLocationId.value };
      });

      const [sourceItemsList, destItemsList] = await Promise.all([
        this.inventoryRepo.findBySkuAndLocationBatch(sourcePairs),
        this.inventoryRepo.findBySkuAndLocationBatch(destPairs),
      ]);

      const sourceItemsMap = new Map(sourceItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));
      const destItemsMap = new Map(destItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));

      const itemsToSave: InventoryItem[] = [];
      const ledgerEntriesData: { sku: string; locationId: string; quantity: number }[] = [];

      for (const item of transfer.items) {
        const sku = variantSkus.get(item.variantId.value)!;

        // 1. Put quantity back at source
        const sourceKey = `${sku}_${transfer.sourceLocationId.value}`;
        let sourceItem = sourceItemsMap.get(sourceKey);
        if (!sourceItem) {
          sourceItem = InventoryItem.createNew(crypto.randomUUID(), sku, transfer.sourceLocationId.value);
          sourceItemsMap.set(sourceKey, sourceItem);
        }
        sourceItem.receiveStock(new Quantity(item.quantity));
        if (!itemsToSave.includes(sourceItem)) {
          itemsToSave.push(sourceItem);
        }

        // Append ledger adjustment back at source (positive transfer return)
        ledgerEntriesData.push({ sku, locationId: transfer.sourceLocationId.value, quantity: item.quantity });

        // 2. Deduct inTransit from destination
        const destKey = `${sku}_${transfer.destinationLocationId.value}`;
        const destItem = destItemsMap.get(destKey);
        if (destItem) {
          destItem.cancelInTransit(new Quantity(item.quantity));
          if (!itemsToSave.includes(destItem)) {
            itemsToSave.push(destItem);
          }
        }
      }

      await this.inventoryRepo.saveBatch(itemsToSave);

      await appendStockLedgerEntries(
        this.productRepo,
        this.ledgerRepo,
        ledgerEntriesData,
        ReasonCode.Transfer,
        { auth: { tenantId, actorId } }
      );
    }

    await this.transferRepo.save(transfer);
    return toDTO(transfer);
  }
}

export class GetStockTransfersUseCase {
  constructor(private readonly transferRepo: IStockTransferRepository) {}

  async execute(tenantId: TenantId): Promise<StockTransfer[]> {
    return await this.transferRepo.findAllByTenant(tenantId);
  }
}

export class GetStockTransferByIdUseCase {
  constructor(private readonly transferRepo: IStockTransferRepository) {}

  async execute(id: string): Promise<StockTransfer | null> {
    return await this.transferRepo.findById(new StockTransferId(id));
  }
}
