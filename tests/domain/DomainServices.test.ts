import { InventoryService } from '../../src/domain/services/InventoryService';
import { InMemoryLedgerRepository } from '../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { LedgerEntry } from '../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../src/domain/valueObjects/LedgerEntryId';
import { ReasonCode } from '../../src/domain/enums/ReasonCode';

describe('Domain Services Gaps', () => {
  const tenantId = new TenantId('T1');
  const locationId = new LocationId('L1');
  const actorId = new ActorId('U1');
  const variantId = new ProductVariantId('V1');

  describe('InventoryService', () => {
    it('should decrement for direct sale', async () => {
      const ledger = new InMemoryLedgerRepository();
      // Pre-populate
      await ledger.append(new LedgerEntry(
        new LedgerEntryId('E1'), tenantId, locationId, variantId, 10, ReasonCode.OpeningBalance, actorId, new Date()
      ));
      
      const service = new InventoryService(ledger);
      await service.decrementForSale(tenantId, locationId, variantId, 3, 'SALE-1', actorId);
      
      expect(await ledger.currentQuantity(variantId, locationId)).toBe(7);
    });

    it('should throw error when decrementing more than available', async () => {
      const ledger = new InMemoryLedgerRepository();
      const service = new InventoryService(ledger);
      
      await expect(service.decrementForSale(tenantId, locationId, variantId, 5, 'S1', actorId))
        .rejects.toThrow('Insufficient stock');
    });

    it('should early-exit if decrement batch is empty', async () => {
      const ledger = new InMemoryLedgerRepository();
      const appendBatchSpy = jest.spyOn(ledger, 'appendBatch');
      const service = new InventoryService(ledger);

      await service.decrementForSaleBatch(tenantId, locationId, [], 'SALE-EMPTY', actorId);

      expect(appendBatchSpy).not.toHaveBeenCalled();
    });

    it('should successfully decrement stock in batch', async () => {
      const ledger = new InMemoryLedgerRepository();
      const variant2 = new ProductVariantId('V2');
      await ledger.append(new LedgerEntry(
        new LedgerEntryId('E1'), tenantId, locationId, variantId, 10, ReasonCode.OpeningBalance, actorId, new Date()
      ));
      await ledger.append(new LedgerEntry(
        new LedgerEntryId('E2'), tenantId, locationId, variant2, 20, ReasonCode.OpeningBalance, actorId, new Date()
      ));

      const service = new InventoryService(ledger);
      const items = [
        { variantId, quantity: 4 },
        { variantId: variant2, quantity: 5 }
      ];

      await service.decrementForSaleBatch(tenantId, locationId, items, 'SALE-BATCH', actorId);

      expect(await ledger.currentQuantity(variantId, locationId)).toBe(6);
      expect(await ledger.currentQuantity(variant2, locationId)).toBe(15);
    });

    it('should throw error and not write any entries if any variant has insufficient stock', async () => {
      const ledger = new InMemoryLedgerRepository();
      const variant2 = new ProductVariantId('V2');
      await ledger.append(new LedgerEntry(
        new LedgerEntryId('E1'), tenantId, locationId, variantId, 10, ReasonCode.OpeningBalance, actorId, new Date()
      ));
      await ledger.append(new LedgerEntry(
        new LedgerEntryId('E2'), tenantId, locationId, variant2, 3, ReasonCode.OpeningBalance, actorId, new Date()
      ));

      const service = new InventoryService(ledger);
      const appendBatchSpy = jest.spyOn(ledger, 'appendBatch');
      const items = [
        { variantId, quantity: 4 },
        { variantId: variant2, quantity: 5 } // 5 requested, only 3 available
      ];

      await expect(service.decrementForSaleBatch(tenantId, locationId, items, 'SALE-BATCH-FAIL', actorId))
        .rejects.toThrow('Insufficient stock');

      expect(appendBatchSpy).not.toHaveBeenCalled();
      // Quantities should remain unchanged
      expect(await ledger.currentQuantity(variantId, locationId)).toBe(10);
      expect(await ledger.currentQuantity(variant2, locationId)).toBe(3);
    });
  });

  describe('VariantBarcodeSet', () => {
    it('should revoke non-primary barcode', () => {
      const { VariantBarcodeSet } = require('../../src/domain/entities/VariantBarcodeSet');
      const { Barcode } = require('../../src/domain/valueObjects/Barcode');
      const { BarcodeSymbology, BarcodeSource } = require('../../src/domain/enums/BarcodeEnums');
      const { Sku } = require('../../src/domain/valueObjects/Sku');
      
      const set = new VariantBarcodeSet(new Sku('SKU1'));
      const a1 = set.assign(new Barcode(BarcodeSymbology.CODE_128, 'B1'), BarcodeSource.Internal);
      const a2 = set.assign(new Barcode(BarcodeSymbology.CODE_128, 'B2'), BarcodeSource.Internal);
      
      expect(set.all).toHaveLength(2);
      set.revoke(a2.id);
      expect(set.all).toHaveLength(1);
      expect(set.all[0].barcode.value).toBe('B1');
    });

    it('should throw error when revoking the primary barcode while others exist', () => {
      const { VariantBarcodeSet } = require('../../src/domain/entities/VariantBarcodeSet');
      const { Barcode } = require('../../src/domain/valueObjects/Barcode');
      const { BarcodeSymbology, BarcodeSource } = require('../../src/domain/enums/BarcodeEnums');
      const { Sku } = require('../../src/domain/valueObjects/Sku');
      
      const set = new VariantBarcodeSet(new Sku('SKU1'));
      const a1 = set.assign(new Barcode(BarcodeSymbology.CODE_128, 'B1'), BarcodeSource.Internal);
      set.assign(new Barcode(BarcodeSymbology.CODE_128, 'B2'), BarcodeSource.Internal);
      
      expect(() => set.revoke(a1.id)).toThrow('Cannot revoke the primary barcode while other assignments exist');
    });

    it('should throw error when revoking non-existent assignment', () => {
      const { VariantBarcodeSet } = require('../../src/domain/entities/VariantBarcodeSet');
      const { Sku } = require('../../src/domain/valueObjects/Sku');
      const { BarcodeAssignmentId } = require('../../src/domain/valueObjects/BarcodeAssignmentId');
      
      const set = new VariantBarcodeSet(new Sku('SKU1'));
      expect(() => set.revoke(new BarcodeAssignmentId('X'))).toThrow('Assignment X not found');
    });
  });
});
