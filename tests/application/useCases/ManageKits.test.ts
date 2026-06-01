import { AssembleKitUseCase, DisassembleKitUseCase } from '../../../src/application/useCases/ManageKits';
import { IKitRepository } from '../../../src/domain/repositories/IKitRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';

import { Kit } from '../../../src/domain/entities/Kit';
import { KitId } from '../../../src/domain/valueObjects/KitId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';

describe('ManageKits Use Cases', () => {
  let kitRepo: jest.Mocked<IKitRepository>;
  let productRepo: jest.Mocked<IProductRepository>;
  let ledgerRepo: jest.Mocked<ILedgerRepository>;
  let costLayers: jest.Mocked<IInventoryCostLayerRepository>;
  let journalRepo: jest.Mocked<IJournalRepository>;

  const tenantId = 'T1';
  const locationId = 'LOC1';
  const actorId = 'A1';
  const referenceId = 'R1';

  beforeEach(() => {
    kitRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      delete: jest.fn(),
    };

    productRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findAll: jest.fn(),
    };

    ledgerRepo = {
      append: jest.fn(),
      appendBatch: jest.fn(),
      currentQuantity: jest.fn(),
      entriesFor: jest.fn(),
      hasAnyEntries: jest.fn(),
    };

    costLayers = {
      save: jest.fn(),
      getActiveLayers: jest.fn(),
      findBySerial: jest.fn(),
    };

    journalRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
  });

  describe('AssembleKitUseCase', () => {
    it('should successfully assemble a kit when stock is sufficient', async () => {
      const kitSkuStr = 'KIT-COMBO';
      const comp1SkuStr = 'COMP1';
      const comp2SkuStr = 'COMP2';

      const comp1VariantId = new ProductVariantId('V-COMP1');
      const comp2VariantId = new ProductVariantId('V-COMP2');
      const kitVariantId = new ProductVariantId('V-KIT');

      // Create domain Kit
      const kit = new Kit(new KitId('K1'), new Sku(kitSkuStr), 'Combo Bundle');
      kit.addComponent(comp1VariantId, 2); // 2 of COMP1
      kit.addComponent(comp2VariantId, 1); // 1 of COMP2
      kitRepo.findBySku.mockResolvedValue(kit);

      // Create domain Products containing variants
      const kitProduct = new Product(new ProductId('P-KIT'), 'Combo Bundle Product');
      const kitVariant = kitProduct.addVariant(new Sku(kitSkuStr), [new VariantAttribute('type', 'bundle')]);
      productRepo.findBySku.mockImplementation(async (sku) => {
        if (sku.value === kitSkuStr) return kitProduct;
        return null;
      });

      // Setup ledger mock
      ledgerRepo.currentQuantity.mockImplementation(async (varId) => {
        if (varId.equals(comp1VariantId)) return 10;
        if (varId.equals(comp2VariantId)) return 5;
        return 0;
      });

      // Setup costing layer mock: FIFO layers for components
      costLayers.getActiveLayers.mockImplementation(async (varId) => {
        if (varId.equals(comp1VariantId)) {
          return [
            new InventoryCostLayer(new InventoryCostLayerId('L1'), comp1VariantId, 10, 100, new Date()) // unit cost 100
          ];
        }
        if (varId.equals(comp2VariantId)) {
          return [
            new InventoryCostLayer(new InventoryCostLayerId('L2'), comp2VariantId, 10, 200, new Date()) // unit cost 200
          ];
        }
        return [];
      });

      const useCase = new AssembleKitUseCase(kitRepo, productRepo, ledgerRepo, costLayers, journalRepo);
      const result = await useCase.execute({
        tenantId,
        locationId,
        kitSku: kitSkuStr,
        quantity: 2, // Assemble 2 kits
        actorId,
        referenceId
      });

      expect(result).toBe(true);

      // Total components required: 2 kits * 2 comp1 = 4 comp1. Unit cost 100 = 400.
      // Total components required: 2 kits * 1 comp2 = 2 comp2. Unit cost 200 = 400.
      // Total cost = 800 cents. Unit cost for kit = 800 / 2 = 400 cents.
      expect(costLayers.save).toHaveBeenCalledWith(expect.objectContaining({
        unitCostCents: 400,
        initialQuantity: 2
      }));

      // Verify double-entry journal entry was saved and is balanced (debit kit $8, credit components $8)
      expect(journalRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        description: expect.stringContaining('Assemble 2 units of Kit'),
      }));
      const journalEntry = journalRepo.save.mock.calls[0][0];
      expect(journalEntry.isBalanced()).toBe(true);
    });

    it('should throw error if any component stock is insufficient', async () => {
      const kitSkuStr = 'KIT-COMBO';
      const comp1VariantId = new ProductVariantId('V-COMP1');
      const kit = new Kit(new KitId('K1'), new Sku(kitSkuStr), 'Combo Bundle');
      kit.addComponent(comp1VariantId, 2);
      kitRepo.findBySku.mockResolvedValue(kit);

      const kitProduct = new Product(new ProductId('P-KIT'), 'Combo Bundle Product');
      kitProduct.addVariant(new Sku(kitSkuStr), [new VariantAttribute('type', 'bundle')]);
      productRepo.findBySku.mockResolvedValue(kitProduct);

      // Stock is only 1, but we need 4
      ledgerRepo.currentQuantity.mockResolvedValue(1);

      const useCase = new AssembleKitUseCase(kitRepo, productRepo, ledgerRepo, costLayers, journalRepo);
      await expect(useCase.execute({
        tenantId,
        locationId,
        kitSku: kitSkuStr,
        quantity: 2,
        actorId,
        referenceId
      })).rejects.toThrow('Insufficient stock');
    });
  });

  describe('DisassembleKitUseCase', () => {
    it('should successfully disassemble a kit when stock is sufficient', async () => {
      const kitSkuStr = 'KIT-COMBO';
      const comp1VariantId = new ProductVariantId('V-COMP1');
      const kitVariantId = new ProductVariantId('V-KIT');

      const kit = new Kit(new KitId('K1'), new Sku(kitSkuStr), 'Combo Bundle');
      kit.addComponent(comp1VariantId, 2);
      kitRepo.findBySku.mockResolvedValue(kit);

      const kitProduct = new Product(new ProductId('P-KIT'), 'Combo Bundle Product');
      const kitVariant = kitProduct.addVariant(new Sku(kitSkuStr), [new VariantAttribute('type', 'bundle')]);
      productRepo.findBySku.mockResolvedValue(kitProduct);

      ledgerRepo.currentQuantity.mockImplementation(async (varId) => {
        if (varId.equals(kitVariant.id)) return 5;
        return 0;
      });

      // Active layers for Kit variant (FIFO)
      costLayers.getActiveLayers.mockImplementation(async (varId) => {
        if (varId.equals(kitVariant.id)) {
          return [
            new InventoryCostLayer(new InventoryCostLayerId('L-KIT'), kitVariant.id, 5, 400, new Date()) // unit cost 400
          ];
        }
        if (varId.equals(comp1VariantId)) {
          return [
            new InventoryCostLayer(new InventoryCostLayerId('L-COMP'), comp1VariantId, 10, 100, new Date()) // unit cost 100
          ];
        }
        return [];
      });

      const useCase = new DisassembleKitUseCase(kitRepo, productRepo, ledgerRepo, costLayers, journalRepo);
      const result = await useCase.execute({
        tenantId,
        locationId,
        kitSku: kitSkuStr,
        quantity: 2, // Disassemble 2 kits
        actorId,
        referenceId
      });

      expect(result).toBe(true);

      // Kit consumed: 2 kits * 400 unit cost = 800 total cost cents.
      // Components restored: 2 kits * 2 = 4 units of comp1.
      // Restored comp1 layer unit cost should be 200 cents (800 / 4).
      expect(costLayers.save).toHaveBeenCalledWith(expect.objectContaining({
        variantId: comp1VariantId,
        initialQuantity: 4,
        unitCostCents: 200
      }));

      const journalEntry = journalRepo.save.mock.calls[0][0];
      expect(journalEntry.isBalanced()).toBe(true);
    });

    it('should throw error if kit stock is insufficient', async () => {
      const kitSkuStr = 'KIT-COMBO';
      const kitVariantId = new ProductVariantId('V-KIT');

      const kit = new Kit(new KitId('K1'), new Sku(kitSkuStr), 'Combo Bundle');
      kitRepo.findBySku.mockResolvedValue(kit);

      const kitProduct = new Product(new ProductId('P-KIT'), 'Combo Bundle Product');
      const kitVariant = kitProduct.addVariant(new Sku(kitSkuStr), [new VariantAttribute('type', 'bundle')]);
      productRepo.findBySku.mockResolvedValue(kitProduct);

      ledgerRepo.currentQuantity.mockResolvedValue(1); // Only 1 in stock, need 2

      const useCase = new DisassembleKitUseCase(kitRepo, productRepo, ledgerRepo, costLayers, journalRepo);
      await expect(useCase.execute({
        tenantId,
        locationId,
        kitSku: kitSkuStr,
        quantity: 2,
        actorId,
        referenceId
      })).rejects.toThrow('Insufficient stock');
    });
  });
});
