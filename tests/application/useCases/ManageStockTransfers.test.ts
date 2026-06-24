import { InMemoryStockTransferRepository } from '../../../src/infrastructure/persistence/InMemoryStockTransferRepository';
import { InMemoryInventoryRepository } from '../../../src/infrastructure/persistence/InMemoryInventoryRepository';
import { InMemoryProductRepository } from '../../../src/infrastructure/persistence/InMemoryProductRepository';
import { InMemoryLedgerRepository } from '../../../src/infrastructure/persistence/InMemoryLedgerRepository';
import {
  CreateStockTransferUseCase,
  DispatchStockTransferUseCase,
  ReceiveStockTransferUseCase,
  CancelStockTransferUseCase,
} from '../../../src/application/useCases/ManageStockTransfers';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { StockTransferId } from '../../../src/domain/valueObjects/StockTransferId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { StockTransferStatus } from '../../../src/domain/enums/StockTransferStatus';
import crypto from 'crypto';

describe('ManageStockTransfers Use Cases', () => {
  let transferRepo: InMemoryStockTransferRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let ledgerRepo: InMemoryLedgerRepository;

  let createUseCase: CreateStockTransferUseCase;
  let dispatchUseCase: DispatchStockTransferUseCase;
  let receiveUseCase: ReceiveStockTransferUseCase;
  let cancelUseCase: CancelStockTransferUseCase;

  const tenantId = 't-1';
  const actorId = 'a-1';
  const sourceLoc = 'LOC-A';
  const destLoc = 'LOC-B';
  const skuStr = 'SKU-TRANS-1';
  let variantIdStr: string;

  beforeEach(async () => {
    transferRepo = new InMemoryStockTransferRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    ledgerRepo = new InMemoryLedgerRepository();

    createUseCase = new CreateStockTransferUseCase(transferRepo);
    dispatchUseCase = new DispatchStockTransferUseCase(
      transferRepo,
      inventoryRepo,
      productRepo,
      ledgerRepo
    );
    receiveUseCase = new ReceiveStockTransferUseCase(
      transferRepo,
      inventoryRepo,
      productRepo,
      ledgerRepo
    );
    cancelUseCase = new CancelStockTransferUseCase(
      transferRepo,
      inventoryRepo,
      productRepo,
      ledgerRepo
    );

    // Seed product catalog
    const product = new Product(new ProductId('p-1'), 'Transfer Product');
    const variant = product.addVariant(new Sku(skuStr), [new VariantAttribute('size', 'M')], VariantTrackingMode.Quantity);
    variantIdStr = variant.id.value;
    await productRepo.save(product);
  });

  describe('CreateStockTransferUseCase', () => {
    it('should create stock transfer in Draft status', async () => {
      const result = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }],
        referenceId: 'ref-123'
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.sourceLocationId).toBe(sourceLoc);
      expect(result.destinationLocationId).toBe(destLoc);
      expect(result.status).toBe(StockTransferStatus.Draft);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ variantId: variantIdStr, quantity: 5 });
      expect(result.referenceId).toBe('ref-123');

      // Verify saved in repository
      const saved = await transferRepo.findById(new StockTransferId(result.id));
      expect(saved).not.toBeNull();
      expect(saved!.status).toBe(StockTransferStatus.Draft);
    });

    it('should throw an error when source and destination locations are the same', async () => {
      await expect(
        createUseCase.execute({
          tenantId,
          sourceLocationId: sourceLoc,
          destinationLocationId: sourceLoc,
          items: [{ variantId: variantIdStr, quantity: 5 }],
          referenceId: 'ref-123'
        })
      ).rejects.toThrow('Source and destination locations cannot be the same.');
    });

    it('should throw an error when items array is empty', async () => {
      await expect(
        createUseCase.execute({
          tenantId,
          sourceLocationId: sourceLoc,
          destinationLocationId: destLoc,
          items: [],
          referenceId: 'ref-123'
        })
      ).rejects.toThrow('Stock transfer must contain at least one item.');
    });

    it('should create stock transfer without a referenceId', async () => {
      const result = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      expect(result.id).toBeDefined();
      expect(result.referenceId).toBeNull();
    });

    it('should throw an error when item quantity is not positive', async () => {
      await expect(
        createUseCase.execute({
          tenantId,
          sourceLocationId: sourceLoc,
          destinationLocationId: destLoc,
          items: [{ variantId: variantIdStr, quantity: -1 }]
        })
      ).rejects.toThrow('Stock transfer item quantity must be positive.');
    });

    it('should throw an error when item quantity is not an integer', async () => {
      await expect(
        createUseCase.execute({
          tenantId,
          sourceLocationId: sourceLoc,
          destinationLocationId: destLoc,
          items: [{ variantId: variantIdStr, quantity: 1.5 }]
        })
      ).rejects.toThrow('Stock transfer item quantity must be an integer.');
    });
  });

  describe('DispatchStockTransferUseCase', () => {
    it('should fail to dispatch if stock transfer not found', async () => {
      await expect(
        dispatchUseCase.execute('non-existent', actorId, tenantId)
      ).rejects.toThrow('Stock transfer non-existent not found.');
    });

    it('should fail to dispatch with invalid transferId when repository returns null', async () => {
      // Setup repository to return null for specific ID
      const invalidId = 'invalid-id';
      jest.spyOn(transferRepo, 'findById').mockResolvedValueOnce(null);

      await expect(
        dispatchUseCase.execute(invalidId, actorId, tenantId)
      ).rejects.toThrow(`Stock transfer ${invalidId} not found.`);
    });

    it('should fail to dispatch if source inventory is missing or insufficient', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      // No inventory item exists yet
      await expect(
        dispatchUseCase.execute(transfer.id, actorId, tenantId)
      ).rejects.toThrow(`Inventory item for SKU ${skuStr} at source location ${sourceLoc} not found.`);

      // Let's seed source inventory with insufficient quantity
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, sourceLoc);
      invItem.receiveStock(new Quantity(3)); // 3 is less than 5
      await inventoryRepo.save(invItem);

      await expect(
        dispatchUseCase.execute(transfer.id, actorId, tenantId)
      ).rejects.toThrow('Insufficient stock');
    });

    it('should dispatch stock transfer, decrease physical stock at source, increase inTransit at destination, and write ledger entry', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      // Seed sufficient inventory at source
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, sourceLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);

      // Dispatch
      const result = await dispatchUseCase.execute(transfer.id, actorId, tenantId);

      expect(result.status).toBe(StockTransferStatus.Dispatched);
      expect(result.dispatchedAt).toBeDefined();

      // Check source inventory has decreased (10 - 5 = 5)
      const sourceInv = await inventoryRepo.findBySkuAndLocation(skuStr, sourceLoc);
      expect(sourceInv!.quantity.value).toBe(5);

      // Check destination inventory has inTransit quantity of 5
      const destInv = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInv).not.toBeNull();
      expect(destInv!.inTransit.value).toBe(5);
      expect(destInv!.quantity.value).toBe(0);

      // Check ledger entries at source
      const sourceLedger = await ledgerRepo.entriesFor(new ProductVariantId(variantIdStr), new LocationId(sourceLoc));
      expect(sourceLedger).toHaveLength(1);
      expect(sourceLedger[0].quantity).toBe(-5);
    });
  });

  describe('ReceiveStockTransferUseCase', () => {
    it('should fail to receive if stock transfer not found', async () => {
      await expect(
        receiveUseCase.execute('non-existent', actorId, tenantId)
      ).rejects.toThrow('Stock transfer non-existent not found.');
    });

    it('should fail to receive with invalid transferId when repository returns null', async () => {
      const invalidId = 'invalid-id';
      jest.spyOn(transferRepo, 'findById').mockResolvedValueOnce(null);
      await expect(
        receiveUseCase.execute(invalidId, actorId, tenantId)
      ).rejects.toThrow(`Stock transfer ${invalidId} not found.`);
    });

    it('should fail to receive if transfer is not in Dispatched status', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      await expect(
        receiveUseCase.execute(transfer.id, actorId, tenantId)
      ).rejects.toThrow('Cannot receive a stock transfer in status: draft');
    });

    it('should fail to receive if destination inventory item is not found', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, sourceLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);
      await dispatchUseCase.execute(transfer.id, actorId, tenantId);
      jest.spyOn(inventoryRepo, 'findBySkuAndLocationBatch').mockResolvedValueOnce([]);
      await expect(receiveUseCase.execute(transfer.id, actorId, tenantId)).rejects.toThrow(`Inventory item for SKU ${skuStr} at destination location ${destLoc} not found.`);
    });

    it('should receive stock transfer, decrement inTransit and increment physical stock at destination, and write ledger entry', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      // Seed and dispatch
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, sourceLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);
      await dispatchUseCase.execute(transfer.id, actorId, tenantId);

      // Receive
      const result = await receiveUseCase.execute(transfer.id, actorId, tenantId);

      expect(result.status).toBe(StockTransferStatus.Received);
      expect(result.receivedAt).toBeDefined();

      // Check destination inventory (inTransit should be 0, physical should be 5)
      const destInv = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInv!.inTransit.value).toBe(0);
      expect(destInv!.quantity.value).toBe(5);

      // Check destination ledger entries (positive 5)
      const destLedger = await ledgerRepo.entriesFor(new ProductVariantId(variantIdStr), new LocationId(destLoc));
      expect(destLedger).toHaveLength(1);
      expect(destLedger[0].quantity).toBe(5);
    });
  });

  describe('CancelStockTransferUseCase', () => {
    it('should fail if stock transfer not found', async () => {
      await expect(
        cancelUseCase.execute('non-existent', actorId, tenantId)
      ).rejects.toThrow('Stock transfer non-existent not found.');
    });

    it('should fail to cancel with invalid transferId when repository returns null', async () => {
      const invalidId = 'invalid-id';
      jest.spyOn(transferRepo, 'findById').mockResolvedValueOnce(null);
      await expect(
        cancelUseCase.execute(invalidId, actorId, tenantId)
      ).rejects.toThrow(`Stock transfer ${invalidId} not found.`);
    });

    it('should cancel a Draft stock transfer without stock/ledger changes', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      const result = await cancelUseCase.execute(transfer.id, actorId, tenantId);
      expect(result.status).toBe(StockTransferStatus.Cancelled);

      // Verify no inventory records or ledger entries exist
      const sourceInv = await inventoryRepo.findBySkuAndLocation(skuStr, sourceLoc);
      expect(sourceInv).toBeNull();
      const destInv = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInv).toBeNull();

      const sourceLedger = await ledgerRepo.entriesFor(new ProductVariantId(variantIdStr), new LocationId(sourceLoc));
      expect(sourceLedger).toHaveLength(0);
    });

    it('should handle missing source item when reversing dispatch by recreating it', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      // Seed and dispatch
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, sourceLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);
      await dispatchUseCase.execute(transfer.id, actorId, tenantId);

      // Mock findBySkuAndLocationBatch to return empty list for source pairs
      jest.spyOn(inventoryRepo, 'findBySkuAndLocationBatch')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(await inventoryRepo.findBySkuAndLocationBatch([{sku: skuStr, locationId: destLoc}]));

      const result = await cancelUseCase.execute(transfer.id, actorId, tenantId);
      expect(result.status).toBe(StockTransferStatus.Cancelled);

      const sourceInv = await inventoryRepo.findBySkuAndLocation(skuStr, sourceLoc);
      expect(sourceInv!.quantity.value).toBe(5); // Dispatched left 5, but mock returned empty, so recreating it adds 5 more... Wait, let's just assert it was recreated and value is 5! Actually, the mock bypassed the real query, so it starts at 0 and adds 5.
    });

    it('should cancel a Dispatched stock transfer and reverse source stock deduction and destination inTransit creation', async () => {
      const transfer = await createUseCase.execute({
        tenantId,
        sourceLocationId: sourceLoc,
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 5 }]
      });

      // Seed and dispatch
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, sourceLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);
      await dispatchUseCase.execute(transfer.id, actorId, tenantId);

      // Cancel
      const result = await cancelUseCase.execute(transfer.id, actorId, tenantId);
      expect(result.status).toBe(StockTransferStatus.Cancelled);

      // Source inventory should be back to 10
      const sourceInv = await inventoryRepo.findBySkuAndLocation(skuStr, sourceLoc);
      expect(sourceInv!.quantity.value).toBe(10);

      // Destination inventory inTransit should be 0
      const destInv = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInv!.inTransit.value).toBe(0);

      // Ledger entries at source should have the negative dispatch entry (-5) and positive reversal entry (+5)
      const sourceLedger = await ledgerRepo.entriesFor(new ProductVariantId(variantIdStr), new LocationId(sourceLoc));
      expect(sourceLedger).toHaveLength(2);
      expect(sourceLedger[0].quantity).toBe(-5);
      expect(sourceLedger[1].quantity).toBe(5);
    });
  });
});
