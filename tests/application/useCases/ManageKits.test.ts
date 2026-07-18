import { AssembleKitUseCase, DisassembleKitUseCase, SellKitUseCase, CreateKitUseCase, AddKitComponentUseCase } from '../../../src/application/useCases/ManageKits';
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
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      delete: jest.fn(),
    };

    productRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      findSkuByVariantId: jest.fn(),
      findSkusByVariantIds: jest.fn(),
      findAll: jest.fn(),
    };

    ledgerRepo = {
      append: jest.fn(),
      appendBatch: jest.fn(),
      currentQuantity: jest.fn(),
      currentQuantities: jest.fn(),
      entriesFor: jest.fn(),
      findRecallEntries: jest.fn(),
      currentQuantityAt: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasAnyEntriesBatch: jest.fn(),
    };

    costLayers = {
      save: jest.fn(),
      saveBatch: jest.fn(),
      getActiveLayers: jest.fn(),
      getActiveLayersBatch: jest.fn(),
      findBySerial: jest.fn(),
    };

    journalRepo = {
      save: jest.fn(),
      saveBatch: jest.fn(),
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
      ledgerRepo.currentQuantities.mockImplementation(async (variantIds) => {
        const map = new Map<string, number>();
        for (const varId of variantIds) {
          if (varId.equals(comp1VariantId)) map.set(varId.value, 10);
          else if (varId.equals(comp2VariantId)) map.set(varId.value, 5);
          else map.set(varId.value, 0);
        }
        return map;
      });

      // Setup costing layer mock: FIFO layers for components
      costLayers.getActiveLayersBatch.mockImplementation(async (varIds) => {
        const map = new Map<string, InventoryCostLayer[]>();
        for (const varId of varIds) {
          if (varId.equals(comp1VariantId)) {
            map.set(varId.value, [
              new InventoryCostLayer(new InventoryCostLayerId('L1'), comp1VariantId, 10, 100, new Date()) // unit cost 100
            ]);
          } else if (varId.equals(comp2VariantId)) {
            map.set(varId.value, [
              new InventoryCostLayer(new InventoryCostLayerId('L2'), comp2VariantId, 10, 200, new Date()) // unit cost 200
            ]);
          }
        }
        return map;
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
      ledgerRepo.currentQuantities.mockImplementation(async (variantIds) => {
        const map = new Map<string, number>();
        for (const varId of variantIds) {
          map.set(varId.value, 1);
        }
        return map;
      });

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
      expect(costLayers.saveBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          variantId: comp1VariantId,
          initialQuantity: 4,
          unitCostCents: 200
        })
      ]));

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

  describe('SellKitUseCase', () => {
    it('successfully sells a kit and decrements component stock', async () => {
      const mockInventoryService = {
        decrementForKitSale: jest.fn().mockResolvedValue(undefined)
      } as any;
      const useCase = new SellKitUseCase(mockInventoryService);

      const input = {
        tenantId: 'T1',
        locationId: 'LOC1',
        kitId: 'K1',
        sku: 'KIT-1',
        name: 'Super Kit',
        quantity: 2,
        referenceId: 'REF-1',
        actorId: 'A1',
        components: [
          { variantId: 'V1', quantity: 3 }
        ]
      };

      const result = await useCase.execute(input);
      expect(result).toBe(true);
      expect(mockInventoryService.decrementForKitSale).toHaveBeenCalled();
    });
  });


  describe('AddKitComponentUseCase', () => {
    it('successfully adds a component to an existing kit', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);

      const kitIdStr = 'K1';
      const variantIdStr = 'V1';
      const quantity = 3;

      const kit = new Kit(new KitId(kitIdStr), new Sku('KIT-1'), 'Test Kit');
      kitRepo.findById.mockResolvedValue(kit);

      const result = await useCase.execute({
        kitId: kitIdStr,
        variantId: variantIdStr,
        quantity
      });

      expect(result).toBe(true);
      expect(kitRepo.findById).toHaveBeenCalledWith(expect.any(KitId));
      expect(kitRepo.findById.mock.calls[0][0].value).toBe(kitIdStr);

      expect(kitRepo.save).toHaveBeenCalled();
      const savedKit = kitRepo.save.mock.calls[0][0];
      expect(savedKit.components).toHaveLength(1);
      expect(savedKit.components[0].variantId.value).toBe(variantIdStr);
      expect(savedKit.components[0].quantity).toBe(quantity);
    });

    it('throws an error if the kit is not found', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);
      kitRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute({
        kitId: 'K99',
        variantId: 'V1',
        quantity: 1
      })).rejects.toThrow("Kit with ID 'K99' not found.");

      expect(kitRepo.save).not.toHaveBeenCalled();
    });

    it('throws an InvalidOperationError if quantity is zero or negative', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);

      await expect(useCase.execute({
        kitId: 'K1',
        variantId: 'V1',
        quantity: 0
      })).rejects.toThrow('Quantity must be greater than zero.');

      await expect(useCase.execute({
        kitId: 'K1',
        variantId: 'V1',
        quantity: -5
      })).rejects.toThrow('Quantity must be greater than zero.');

      expect(kitRepo.findById).not.toHaveBeenCalled();
      expect(kitRepo.save).not.toHaveBeenCalled();
    });

    it('throws an error if kitId is empty', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);

      await expect(useCase.execute({
        kitId: '',
        variantId: 'V1',
        quantity: 1
      })).rejects.toThrow('KitId cannot be empty.');

      expect(kitRepo.findById).not.toHaveBeenCalled();
    });

    it('throws an error if variantId is empty', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);
      const kit = new Kit(new KitId('K1'), new Sku('KIT-1'), 'Test Kit');
      kitRepo.findById.mockResolvedValue(kit);

      await expect(useCase.execute({
        kitId: 'K1',
        variantId: '',
        quantity: 1
      })).rejects.toThrow('ProductVariantId cannot be empty.');

      expect(kitRepo.save).not.toHaveBeenCalled();
    });

    it('propagates errors if kitRepo.findById fails', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);
      kitRepo.findById.mockRejectedValue(new Error('Database connection failed'));

      await expect(useCase.execute({
        kitId: 'K1',
        variantId: 'V1',
        quantity: 1
      })).rejects.toThrow('Database connection failed');

      expect(kitRepo.save).not.toHaveBeenCalled();
    });

    it('propagates errors if kitRepo.save fails', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);
      const kit = new Kit(new KitId('K1'), new Sku('KIT-1'), 'Test Kit');
      kitRepo.findById.mockResolvedValue(kit);
      kitRepo.save.mockRejectedValue(new Error('Failed to save to database'));

      await expect(useCase.execute({
        kitId: 'K1',
        variantId: 'V1',
        quantity: 1
      })).rejects.toThrow('Failed to save to database');
    });
  });

  describe('CreateKitUseCase', () => {
    it('successfully creates a kit', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      kitRepo.save.mockResolvedValue(undefined);

      const input = {
        id: 'K2',
        sku: 'KIT-2',
        name: 'Another Kit',
        components: [
          { variantId: 'V1', quantity: 2 },
          { variantId: 'V2', quantity: 1 }
        ]
      };

      const result = await useCase.execute(input);
      expect(result).toBe(true);
      expect(kitRepo.save).toHaveBeenCalled();
      const savedKit = kitRepo.save.mock.calls[0][0];
      expect(savedKit.id.value).toBe('K2');
      expect(savedKit.sku.value).toBe('KIT-2');
      expect(savedKit.components).toHaveLength(2);
    });

    it('successfully creates a kit with no components', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      kitRepo.save.mockResolvedValue(undefined);

      const input = {
        id: 'K3',
        sku: 'KIT-3',
        name: 'Empty Kit',
        components: []
      };

      const result = await useCase.execute(input);
      expect(result).toBe(true);
      expect(kitRepo.save).toHaveBeenCalled();
      const savedKit = kitRepo.save.mock.calls[0][0];
      expect(savedKit.id.value).toBe('K3');
      expect(savedKit.components).toHaveLength(0);
    });

    it('propagates errors if kit repository fails to save', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      kitRepo.save.mockRejectedValue(new Error('Database error'));

      const input = {
        id: 'K4',
        sku: 'KIT-4',
        name: 'Failing Kit',
        components: []
      };

      await expect(useCase.execute(input)).rejects.toThrow('Database error');
    });

    it('throws error when SKU is empty', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      const input = {
        id: 'K5',
        sku: '',
        name: 'Invalid Kit',
        components: []
      };

      await expect(useCase.execute(input)).rejects.toThrow('SKU cannot be empty.');
      expect(kitRepo.save).not.toHaveBeenCalled();
    });

    it('throws error when SKU contains invalid characters', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      const input = {
        id: 'K6',
        sku: 'INVALID SKU!',
        name: 'Invalid Kit',
        components: []
      };

      await expect(useCase.execute(input)).rejects.toThrow('SKU must contain only alphanumeric characters and hyphens.');
      expect(kitRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('AddKitComponentUseCase', () => {
    it('successfully adds a component to an existing kit', async () => {
      const useCase = new AddKitComponentUseCase(kitRepo);

      const existingKit = new Kit(new KitId('K-EX'), new Sku('KIT-EX'), 'Existing Kit');
      existingKit.addComponent(new ProductVariantId('V-EX1'), 2);
      kitRepo.findById.mockResolvedValue(existingKit);
      kitRepo.save.mockResolvedValue(undefined);

    it('throws error if kit id is empty', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      const input = {
        id: '   ',
        sku: 'KIT-VALID',
        name: 'Valid Name',
        components: []
      };
      await expect(useCase.execute(input)).rejects.toThrow('KitId cannot be empty.');
    });

    it('throws error if sku format is invalid', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      const input = {
        id: 'K-VALID',
        sku: 'INVALID SKU!',
        name: 'Valid Name',
        components: []
      };
      await expect(useCase.execute(input)).rejects.toThrow('SKU must contain only alphanumeric characters and hyphens.');
    });

    it('throws error if a component quantity is less than 1', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      const input = {
        id: 'K5',
        sku: 'KIT-5',
        name: 'Invalid Component Kit',
        components: [
          { variantId: 'V1', quantity: 0 }
        ]
      };
      await expect(useCase.execute(input)).rejects.toThrow('Kit component quantity must be at least 1.');
    });

    it('merges duplicate components correctly', async () => {
      const useCase = new CreateKitUseCase(kitRepo);
      kitRepo.save.mockResolvedValue(undefined);

      const input = {
        id: 'K6',
        sku: 'KIT-6',
        name: 'Duplicate Component Kit',
        components: [
          { variantId: 'V1', quantity: 2 },
          { variantId: 'V1', quantity: 3 }
        ]
      };

      const result = await useCase.execute(input);
      expect(result).toBe(true);

      const savedKit = kitRepo.save.mock.calls[0][0];
      expect(savedKit.components).toHaveLength(1);
      expect(savedKit.components[0].variantId.value).toBe('V1');
      expect(savedKit.components[0].quantity).toBe(5);
    });
  });

});
