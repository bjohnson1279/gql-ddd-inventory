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

    it('should throw error when revoking non-existent assignment', () => {
      const { VariantBarcodeSet } = require('../../src/domain/entities/VariantBarcodeSet');
      const { Sku } = require('../../src/domain/valueObjects/Sku');
      const { BarcodeAssignmentId } = require('../../src/domain/valueObjects/BarcodeAssignmentId');
      
      const set = new VariantBarcodeSet(new Sku('SKU1'));
      expect(() => set.revoke(new BarcodeAssignmentId('X'))).toThrow('Assignment X not found');
    });
  });
});
