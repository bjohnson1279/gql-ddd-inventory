import crypto from 'crypto';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { CountItemInputDTO, CountResultDTO } from '../dtos/SubmitInventoryCountDTO';
import { DomainEventDispatcher } from '../services/DomainEventDispatcher';
import { WMSCapacityService } from '../../domain/services/WMSCapacityService';
import { ValidationError } from '../../domain/exceptions/DomainErrors';

export class SubmitInventoryCountUseCase {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly capacityService?: WMSCapacityService,
    private readonly approvalService?: any
  ) {}

  async execute(counts: CountItemInputDTO[], tenantId?: string, actorId?: string): Promise<CountResultDTO[]> {
    const results: CountResultDTO[] = [];

    if (!Array.isArray(counts)) {
      throw new ValidationError('Input counts must be an array');
    }

    if (counts.length === 0) return results;

    if (this.capacityService) {
      // Group counts by locationId to run one capacity check per location
      const countsByLocation = new Map<string, { sku: string; quantity: number }[]>();
      for (const count of counts) {
        const list = countsByLocation.get(count.locationId) ?? [];
        list.push({ sku: count.sku, quantity: count.actualQuantity });
        countsByLocation.set(count.locationId, list);
      }

      for (const [locationId, items] of countsByLocation.entries()) {
        const adjustments = items.map(item => ({
          sku: item.sku,
          mode: 'absolute' as const,
          quantity: item.quantity
        }));
        await this.capacityService.validateCapacity(locationId, adjustments);
      }
    }

    const pairs = counts.map(c => ({ sku: c.sku, locationId: c.locationId }));
    const existingItems = await this.inventoryRepository.findBySkuAndLocationBatch(pairs);

    const itemsMap = new Map<string, InventoryItem>();
    for (const item of existingItems) {
      itemsMap.set(`${item.sku.value}_${item.locationId.value}`, item);
    }

    const itemsToSave = new Map<string, InventoryItem>();
    let totalAbsoluteVariance = 0;

    for (const count of counts) {
      const key = `${count.sku}_${count.locationId}`;
      let item = itemsMap.get(key);

      if (!item) {
        const id = crypto.randomUUID();
        item = InventoryItem.createNew(id, count.sku, count.locationId);
        itemsMap.set(key, item);
      }

      const actualQty = new Quantity(count.actualQuantity);
      const expectedQuantity = item.quantity;
      const variance = count.actualQuantity - expectedQuantity.value;
      
      totalAbsoluteVariance += Math.abs(variance);

      const reconciliationResult = item.reconcileStock(actualQty);
      
      itemsToSave.set(key, item);

      results.push({
        sku: count.sku,
        locationId: count.locationId,
        ...reconciliationResult
      });
    }

    if (this.approvalService && tenantId && actorId && totalAbsoluteVariance > 0) {
      const result = await this.approvalService.evaluateAndIntercept(
        tenantId,
        'inventory.count',
        'InventoryCount',
        'bulk',
        actorId,
        { totalAbsoluteVariance, counts }
      );

      if (result.intercepted) {
        throw new Error(`RequiresApproval:${result.requestId}`);
      }
    }

    const uniqueItemsToSave = Array.from(itemsToSave.values());
    await this.inventoryRepository.saveBatch(uniqueItemsToSave);

    for (const item of uniqueItemsToSave) {
      this.eventDispatcher.dispatch(item.pullDomainEvents());
    }

    return results;
  }
}

