import { InventoryService } from '../../../src/domain/services/InventoryService';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import { Kit } from '../../../src/domain/entities/Kit';
import { KitId } from '../../../src/domain/valueObjects/KitId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LedgerEntry } from '../../../src/domain/entities/LedgerEntry';
import { InventoryDecremented } from '../../../src/domain/events/InventoryEvents';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let ledgerRepository: jest.Mocked<ILedgerRepository>;
  let eventDispatcher: jest.Mock;

  const tenantId = new TenantId('tenant-1');
  const locationId = new LocationId('loc-1');
  const variantId1 = new ProductVariantId('var-1');
  const variantId2 = new ProductVariantId('var-2');
  const actor = new ActorId('actor-1');
  const saleId = 'sale-1';

  beforeEach(() => {
    ledgerRepository = {
      append: jest.fn(),
      appendBatch: jest.fn(),
      currentQuantity: jest.fn(),
      currentQuantities: jest.fn(),
      entriesFor: jest.fn(),
      entriesForBatch: jest.fn(),
      findRecallEntries: jest.fn(),
      currentQuantityAt: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasAnyEntriesBatch: jest.fn(),
    };
    eventDispatcher = jest.fn();
    inventoryService = new InventoryService(ledgerRepository, eventDispatcher);
  });

  describe('decrementForSale', () => {
    it('should successfully decrement inventory for a sale', async () => {
      ledgerRepository.currentQuantity.mockResolvedValue(10);

      await inventoryService.decrementForSale(tenantId, locationId, variantId1, 2, saleId, actor);

      expect(ledgerRepository.currentQuantity).toHaveBeenCalledWith(variantId1, locationId);
      expect(ledgerRepository.append).toHaveBeenCalledTimes(1);

      const entry = ledgerRepository.append.mock.calls[0][0];
      expect(entry.tenantId).toBe(tenantId);
      expect(entry.locationId).toBe(locationId);
      expect(entry.variantId).toBe(variantId1);
      expect(entry.quantity).toBe(-2);
      expect(entry.reason).toBe(ReasonCode.Sale);
      expect(entry.referenceId).toBe(saleId);
      expect(entry.actor).toBe(actor);

      expect(eventDispatcher).toHaveBeenCalledTimes(1);
      expect(eventDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantId.value,
          locationId: locationId.value,
          variantId: variantId1,
          quantity: 2,
          referenceId: saleId
        })
      );
    });

    it('should throw an error if stock is insufficient', async () => {
      ledgerRepository.currentQuantity.mockResolvedValue(1);

      await expect(
        inventoryService.decrementForSale(tenantId, locationId, variantId1, 2, saleId, actor)
      ).rejects.toThrow('Insufficient stock for variant var-1. Requested: 2, Available: 1');

      expect(ledgerRepository.append).not.toHaveBeenCalled();
      expect(eventDispatcher).not.toHaveBeenCalled();
    });
  });

  describe('decrementForSaleBatch', () => {
    it('should successfully decrement inventory for multiple items', async () => {
      const map = new Map<string, number>();
      map.set(variantId1.value, 10);
      map.set(variantId2.value, 5);
      ledgerRepository.currentQuantities.mockResolvedValue(map);

      const items = [
        { variantId: variantId1, quantity: 2 },
        { variantId: variantId2, quantity: 3 }
      ];

      await inventoryService.decrementForSaleBatch(tenantId, locationId, items, saleId, actor);

      expect(ledgerRepository.currentQuantities).toHaveBeenCalledWith([variantId1, variantId2], locationId);
      expect(ledgerRepository.appendBatch).toHaveBeenCalledTimes(1);

      const entries = ledgerRepository.appendBatch.mock.calls[0][0];
      expect(entries).toHaveLength(2);
      expect(entries[0].variantId).toBe(variantId1);
      expect(entries[0].quantity).toBe(-2);
      expect(entries[1].variantId).toBe(variantId2);
      expect(entries[1].quantity).toBe(-3);

      expect(eventDispatcher).toHaveBeenCalledTimes(2);
      expect(eventDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantId.value,
          locationId: locationId.value,
          variantId: variantId1,
          quantity: 2,
          referenceId: saleId
        })
      );
      expect(eventDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantId.value,
          locationId: locationId.value,
          variantId: variantId2,
          quantity: 3,
          referenceId: saleId
        })
      );
    });

    it('should throw an error if any item has insufficient stock', async () => {
      const map = new Map<string, number>();
      map.set(variantId1.value, 10);
      map.set(variantId2.value, 2); // Requested 3, but only 2 available
      ledgerRepository.currentQuantities.mockResolvedValue(map);

      const items = [
        { variantId: variantId1, quantity: 2 },
        { variantId: variantId2, quantity: 3 }
      ];

      await expect(
        inventoryService.decrementForSaleBatch(tenantId, locationId, items, saleId, actor)
      ).rejects.toThrow('Insufficient stock for variant var-2. Requested: 3, Available: 2');

      expect(ledgerRepository.appendBatch).not.toHaveBeenCalled();
      expect(eventDispatcher).not.toHaveBeenCalled();
    });

    it('should do nothing if items array is empty', async () => {
      await inventoryService.decrementForSaleBatch(tenantId, locationId, [], saleId, actor);

      expect(ledgerRepository.currentQuantities).not.toHaveBeenCalled();
      expect(ledgerRepository.appendBatch).not.toHaveBeenCalled();
      expect(eventDispatcher).not.toHaveBeenCalled();
    });
  });

  describe('decrementForKitSale', () => {
    let kit: Kit;

    beforeEach(() => {
      kit = new Kit(new KitId('kit-1'), new Sku('sku-kit'), 'Test Kit');
    });

    it('should throw an error if the kit is empty', async () => {
      await expect(
        inventoryService.decrementForKitSale(tenantId, locationId, kit, 1, saleId, actor)
      ).rejects.toThrow('Cannot sell a kit with no components.');

      expect(ledgerRepository.currentQuantities).not.toHaveBeenCalled();
      expect(ledgerRepository.appendBatch).not.toHaveBeenCalled();
      expect(eventDispatcher).not.toHaveBeenCalled();
    });

    it('should successfully decrement inventory for a kit sale', async () => {
      kit.addComponent(variantId1, 2); // 2 of variant1 per kit
      kit.addComponent(variantId2, 1); // 1 of variant2 per kit

      const map = new Map<string, number>();
      map.set(variantId1.value, 20);
      map.set(variantId2.value, 10);
      ledgerRepository.currentQuantities.mockResolvedValue(map);

      // Sell 3 kits, so we need 6 of variant1 and 3 of variant2
      await inventoryService.decrementForKitSale(tenantId, locationId, kit, 3, saleId, actor);

      expect(ledgerRepository.currentQuantities).toHaveBeenCalledWith([variantId1, variantId2], locationId);
      expect(ledgerRepository.appendBatch).toHaveBeenCalledTimes(1);

      const entries = ledgerRepository.appendBatch.mock.calls[0][0];
      expect(entries).toHaveLength(2);
      expect(entries[0].variantId).toBe(variantId1);
      expect(entries[0].quantity).toBe(-6);
      expect(entries[0].reason).toBe(ReasonCode.KitSale);
      expect(entries[1].variantId).toBe(variantId2);
      expect(entries[1].quantity).toBe(-3);
      expect(entries[1].reason).toBe(ReasonCode.KitSale);

      expect(eventDispatcher).toHaveBeenCalledTimes(2);
      expect(eventDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantId.value,
          locationId: locationId.value,
          variantId: variantId1,
          quantity: 6,
          referenceId: saleId
        })
      );
      expect(eventDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantId.value,
          locationId: locationId.value,
          variantId: variantId2,
          quantity: 3,
          referenceId: saleId
        })
      );
    });

    it('should throw an error if any component has insufficient stock for kit sale', async () => {
      kit.addComponent(variantId1, 2);
      kit.addComponent(variantId2, 1);

      const map = new Map<string, number>();
      map.set(variantId1.value, 20);
      map.set(variantId2.value, 2); // Only 2 available, but we need 3 (1 component/kit * 3 kits)
      ledgerRepository.currentQuantities.mockResolvedValue(map);

      await expect(
        inventoryService.decrementForKitSale(tenantId, locationId, kit, 3, saleId, actor)
      ).rejects.toThrow('Insufficient stock for variant var-2. Requested: 3, Available: 2');

      expect(ledgerRepository.appendBatch).not.toHaveBeenCalled();
      expect(eventDispatcher).not.toHaveBeenCalled();
    });
  });

  describe('assertSufficientStock', () => {
    it('should resolve if stock is sufficient', async () => {
      ledgerRepository.currentQuantity.mockResolvedValue(5);
      await expect((inventoryService as any).assertSufficientStock(variantId1, locationId, 5)).resolves.toBeUndefined();
    });

    it('should throw error if stock is insufficient', async () => {
      ledgerRepository.currentQuantity.mockResolvedValue(4);
      await expect((inventoryService as any).assertSufficientStock(variantId1, locationId, 5)).rejects.toThrow(
        'Insufficient stock for variant var-1. Requested: 5, Available: 4'
      );
    });
  });
});
