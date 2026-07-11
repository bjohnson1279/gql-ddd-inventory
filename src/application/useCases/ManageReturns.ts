import crypto from 'crypto';
import { IRmaRepository } from '../../domain/repositories/IRmaRepository';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { IQuarantineRepository } from '../../domain/repositories/IQuarantineRepository';
import { IJournalRepository } from '../../domain/repositories/IJournalRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { ISerializedItemRepository } from '../../domain/repositories/ISerializedItemRepository';
import { Rma } from '../../domain/entities/Rma';
import { RmaItem } from '../../domain/entities/RmaItem';
import { QuarantineItem } from '../../domain/entities/QuarantineItem';
import { InventoryCostLayer, InventoryCostLayerId } from '../../domain/entities/InventoryCostLayer';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { RMAStatus, RMADisposition, RMAItemStatus, QuarantineStatus } from '../../domain/enums/ReturnEnums';
import { SerializedItemStatus } from '../../domain/enums/SerializedItemStatus';
import { SerializedItem } from '../../domain/entities/SerializedItem';
import { CostLayerService } from '../../domain/services/CostLayerService';
import { AccountingJournalService } from '../../domain/services/AccountingJournalService';

export interface CreateRmaItemDTO {
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

export interface CreateRmaDTO {
  rmaNumber: string;
  tenantId: string;
  customerId: string;
  locationId: string;
  items: CreateRmaItemDTO[];
}

export class CreateRmaUseCase {
  constructor(private readonly rmaRepository: IRmaRepository) {}

  async execute(dto: CreateRmaDTO): Promise<Rma> {
    const existing = await this.rmaRepository.findByNumber(dto.rmaNumber);
    if (existing) {
      throw new Error(`RMA with number ${dto.rmaNumber} already exists.`);
    }

    const items = dto.items.map(
      (item) =>
        new RmaItem(
          crypto.randomUUID(),
          new ProductVariantId(item.variantId),
          item.quantity,
          item.unitCostCents
        )
    );

    const rma = new Rma(
      crypto.randomUUID(),
      dto.rmaNumber,
      new TenantId(dto.tenantId),
      dto.customerId,
      new LocationId(dto.locationId),
      RMAStatus.Requested,
      items
    );

    await this.rmaRepository.save(rma);
    return rma;
  }
}

export class AuthorizeRmaUseCase {
  constructor(private readonly rmaRepository: IRmaRepository) {}

  async execute(rmaId: string): Promise<void> {
    const rma = await this.rmaRepository.findById(rmaId);
    if (!rma) {
      throw new Error(`RMA with ID ${rmaId} not found.`);
    }

    rma.authorize();
    await this.rmaRepository.save(rma);
  }
}

export interface ReceiveRmaItemDTO {
  variantId: string;
  quantityReceived: number;
  disposition: RMADisposition;
  serialNumbers?: string[];
}

export interface ReceiveRmaDTO {
  rmaId: string;
  items: ReceiveRmaItemDTO[];
}

export class ReceiveRmaUseCase {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly rmaRepository: IRmaRepository,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: IInventoryCostLayerRepository,
    private readonly quarantineRepository: IQuarantineRepository,
    private readonly journalRepository: IJournalRepository,
    private readonly productRepository: IProductRepository,
    private readonly serializedItemRepository?: ISerializedItemRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepository);
    this.journalService = new AccountingJournalService(journalRepository);
  }

  async execute(dto: ReceiveRmaDTO): Promise<void> {
    const rma = await this.rmaRepository.findById(dto.rmaId);
    if (!rma) {
      throw new Error(`RMA with ID ${dto.rmaId} not found.`);
    }

    // Batch SKU Lookups
    const variantIds = Array.from(new Set(dto.items.map(item => item.variantId)));
    const skusByVariant = await this.productRepository.findSkusByVariantIds(variantIds);

    // Batch Inventory Item Lookups
    const pairs = dto.items.map(item => {
      const skuStr = skusByVariant.get(item.variantId);
      if (!skuStr) throw new Error(`SKU not found for variant ID ${item.variantId}`);
      const targetLocationId = item.disposition === RMADisposition.Quarantine ? `${rma.locationId.value}-quarantine` : rma.locationId.value;
      return { sku: skuStr, locationId: targetLocationId };
    });
    const existingItemsList = await this.inventoryRepository.findBySkuAndLocationBatch(pairs);
    const existingItems = new Map<string, InventoryItem>();
    for (const item of existingItemsList) {
      existingItems.set(`${item.sku.value}_${item.locationId.value}`, item);
    }

    const itemsToSave = new Map<string, InventoryItem>();
    const costLayersToSave: InventoryCostLayer[] = [];
    const quarantineItemsToSave: QuarantineItem[] = [];
    const serializedItemsToSave: SerializedItem[] = [];

    // Batch Serialized Item Lookups
    const serialPairs: { serialNumber: SerialNumber; variantId: ProductVariantId }[] = [];
    for (const item of dto.items) {
      if (item.serialNumbers) {
        for (const sn of item.serialNumbers) {
          serialPairs.push({
            serialNumber: new SerialNumber(sn),
            variantId: new ProductVariantId(item.variantId)
          });
        }
      }
    }

    const existingSerialItemsList = this.serializedItemRepository && serialPairs.length > 0
      ? await this.serializedItemRepository.findBySerialsAndVariantsBatch(serialPairs)
      : [];

    const existingSerialItems = new Map<string, SerializedItem>();
    for (const item of existingSerialItemsList) {
      existingSerialItems.set(`${item.variantId.value}_${item.serialNumber.value}`, item);
    }

    for (const item of dto.items) {
      const rmaItem = rma.items.find((i) => i.variantId.value === item.variantId);
      if (!rmaItem) {
        throw new Error(`Item with variant ID ${item.variantId} not found in RMA.`);
      }

      // 1. Process receipt on RMA aggregate
      rma.receiveItem(item.variantId, item.quantityReceived, item.disposition);

      const targetLocationId =
        item.disposition === RMADisposition.Quarantine
          ? `${rma.locationId.value}-quarantine`
          : rma.locationId.value;

      // 2. Lookup SKU for target variant
      const skuStr = skusByVariant.get(item.variantId)!;

      // 3. Increment stock level
      const invKey = `${skuStr}_${targetLocationId}`;
      let invItem = existingItems.get(invKey);
      if (!invItem) {
        invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, targetLocationId);
        existingItems.set(invKey, invItem);
      }
      invItem.receiveStock(new Quantity(item.quantityReceived));
      itemsToSave.set(invKey, invItem);

      // 4. Create Cost Layer
      const layerId = crypto.randomUUID();
      const layer = new InventoryCostLayer(
        new InventoryCostLayerId(layerId),
        new ProductVariantId(item.variantId),
        item.quantityReceived,
        rmaItem.unitCostCents,
        new Date()
      );
      costLayersToSave.push(layer);

      // 5. Create Quarantine record if quarantined
      if (item.disposition === RMADisposition.Quarantine) {
        const qId = crypto.randomUUID();
        const quarantineItem = new QuarantineItem(
          qId,
          new ProductVariantId(item.variantId),
          item.quantityReceived,
          `Returned from RMA ${rma.rmaNumber}`,
          rma.locationId,
          rma.tenantId
        );
        quarantineItemsToSave.push(quarantineItem);
      }

      // 6. Post return journal entries
      const totalCostCents = rmaItem.unitCostCents * item.quantityReceived;
      await this.journalService.onStockReturned(
        item.variantId,
        totalCostCents,
        rma.id,
        new Date(),
        rma.tenantId.value
      );

      // 7. Handle immediate scrap write-off
      if (item.disposition === RMADisposition.Scrap) {
        // Decrement stock level
        invItem.dispatchStock(new Quantity(item.quantityReceived));

        // We will batch the cost layer consumption outside the loop

        // Post write-off journal entry
        await this.journalService.onInventoryWriteOff(
          rma.id,
          totalCostCents,
          new Date(),
          rma.tenantId.value
        );
      }

      // 8. Handle Serialized items transitions
      if (item.serialNumbers && this.serializedItemRepository) {
        for (const sn of item.serialNumbers) {
          const serialObj = new SerialNumber(sn);
          const serialItem = existingSerialItems.get(`${item.variantId}_${serialObj.value}`);
          if (serialItem) {
            const actor = new ActorId('system');
            const refId = `RMA-${rma.id}`;
            
            // First transition to Returned
            serialItem.transitionTo(SerializedItemStatus.Returned, 'RMA return receipt', actor, refId);

            // Then transition based on disposition
            if (item.disposition === RMADisposition.Restock) {
              serialItem.transitionTo(SerializedItemStatus.InStock, 'Restocked from RMA', actor, refId);
            } else if (item.disposition === RMADisposition.Quarantine) {
              serialItem.transitionTo(SerializedItemStatus.Quarantined, 'Quarantined from RMA', actor, refId);
            } else if (item.disposition === RMADisposition.Scrap) {
              serialItem.transitionTo(SerializedItemStatus.WrittenOff, 'Scrapped from RMA', actor, refId);
            }
            serializedItemsToSave.push(serialItem);
          }
        }
      }
    }

    const scrapItems = dto.items.filter(item => item.disposition === RMADisposition.Scrap).map(item => ({
      variantId: new ProductVariantId(item.variantId),
      quantity: item.quantityReceived
    }));

    if (scrapItems.length > 0) {
      await this.costLayerService.consumeFifoLayersBatch(scrapItems);
    }

    if (itemsToSave.size > 0) {
      await this.inventoryRepository.saveBatch(Array.from(itemsToSave.values()));
    }

    if (costLayersToSave.length > 0) {
      await this.costLayerRepository.saveBatch(costLayersToSave);
    }

    if (quarantineItemsToSave.length > 0) {
      await this.quarantineRepository.saveBatch(quarantineItemsToSave);
    }

    if (serializedItemsToSave.length > 0 && this.serializedItemRepository) {
      await this.serializedItemRepository.saveBatch(serializedItemsToSave);
    }

    await this.rmaRepository.save(rma);
  }
}

export interface ResolveQuarantineItemDTO {
  quarantineItemId: string;
  resolution: 'RESTOCK' | 'SCRAP' | 'RTV';
}

export class ResolveQuarantineItemUseCase {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly quarantineRepository: IQuarantineRepository,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: IInventoryCostLayerRepository,
    private readonly journalRepository: IJournalRepository,
    private readonly productRepository: IProductRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepository);
    this.journalService = new AccountingJournalService(journalRepository);
  }

  async execute(dto: ResolveQuarantineItemDTO): Promise<void> {
    const qItem = await this.quarantineRepository.findById(dto.quarantineItemId);
    if (!qItem) {
      throw new Error(`Quarantine item with ID ${dto.quarantineItemId} not found.`);
    }

    const skuStr = await this.productRepository.findSkuByVariantId(qItem.variantId.value);
    if (!skuStr) {
      throw new Error(`SKU not found for variant ID ${qItem.variantId.value}`);
    }

    const quarantineLocId = `${qItem.locationId.value}-quarantine`;

    // 1. Decrement stock from Quarantine location
    const invQuarantineItem = await this.inventoryRepository.findBySkuAndLocation(skuStr, quarantineLocId);
    if (!invQuarantineItem) {
      throw new Error(`Quarantine stock not found for variant ${qItem.variantId.value} at ${quarantineLocId}.`);
    }
    invQuarantineItem.dispatchStock(new Quantity(qItem.quantity));

    const itemsToSave = new Map<string, InventoryItem>();
    itemsToSave.set(invQuarantineItem.id, invQuarantineItem);

    const consumeQuarantineLayers = async (qty: number): Promise<number> => {
      const breakdown = await this.costLayerService.consumeFifoLayers(qItem.variantId, qty);
      return breakdown.totalCostCents;
    };

    if (dto.resolution === 'RESTOCK') {
      qItem.resolveRestock();

      // Increment sellable stock
      let invItem = await this.inventoryRepository.findBySkuAndLocation(skuStr, qItem.locationId.value);
      if (!invItem) {
        invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, qItem.locationId.value);
      }
      invItem.receiveStock(new Quantity(qItem.quantity));
      itemsToSave.set(invItem.id, invItem);
    } else if (dto.resolution === 'SCRAP') {
      qItem.resolveScrap();

      const totalCostCents = await consumeQuarantineLayers(qItem.quantity);

      await this.journalService.onInventoryWriteOff(
        qItem.id,
        totalCostCents,
        new Date(),
        qItem.tenantId.value
      );
    } else if (dto.resolution === 'RTV') {
      qItem.resolveRtv();

      const totalCostCents = await consumeQuarantineLayers(qItem.quantity);

      await this.journalService.onReturnToVendor(
        qItem.id,
        totalCostCents,
        new Date(),
        qItem.tenantId.value
      );
    }

    if (itemsToSave.size > 0) {
      await this.inventoryRepository.saveBatch(Array.from(itemsToSave.values()));
    }

    await this.quarantineRepository.save(qItem);
  }
}
