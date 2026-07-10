import { InMemoryReplenishmentRuleRepository } from '../../../src/infrastructure/persistence/InMemoryReplenishmentRuleRepository';
import { InMemoryInventoryRepository } from '../../../src/infrastructure/persistence/InMemoryInventoryRepository';
import { InMemoryProductRepository } from '../../../src/infrastructure/persistence/InMemoryProductRepository';
import { InMemoryPurchaseOrderRepository } from '../../../src/infrastructure/persistence/InMemoryPurchaseOrderRepository';
import { InMemoryStockTransferRepository } from '../../../src/infrastructure/persistence/InMemoryStockTransferRepository';
import { InMemoryLedgerRepository } from '../../../src/infrastructure/persistence/InMemoryLedgerRepository';
import {
  CreateReplenishmentRuleUseCase,
  UpdateReplenishmentRuleUseCase,
  ToggleReplenishmentRuleUseCase,
  EvaluateReplenishmentUseCase,
  CreatePurchaseOrderUseCase,
  PlacePurchaseOrderUseCase,
  ReceivePurchaseOrderUseCase,
  CancelPurchaseOrderUseCase,
} from '../../../src/application/useCases/ManageReplenishment';
import { DemandVelocityCalculator, ReorderPointForecaster } from '../../../src/domain/services/ReplenishmentForecaster';
import { ReplenishmentEvaluator } from '../../../src/domain/services/ReplenishmentEvaluator';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { ReplenishmentType } from '../../../src/domain/enums/ReplenishmentType';
import { PurchaseOrderStatus } from '../../../src/domain/enums/PurchaseOrderStatus';
import { StockTransferStatus } from '../../../src/domain/enums/StockTransferStatus';
import { LedgerEntry } from '../../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../../src/domain/valueObjects/LedgerEntryId';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import crypto from 'crypto';

describe('ManageReplenishment Use Cases', () => {
  let ruleRepo: InMemoryReplenishmentRuleRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let poRepo: InMemoryPurchaseOrderRepository;
  let transferRepo: InMemoryStockTransferRepository;
  let ledgerRepo: InMemoryLedgerRepository;

  let createRuleUseCase: CreateReplenishmentRuleUseCase;
  let updateRuleUseCase: UpdateReplenishmentRuleUseCase;
  let toggleRuleUseCase: ToggleReplenishmentRuleUseCase;
  let evaluateUseCase: EvaluateReplenishmentUseCase;

  let createPoUseCase: CreatePurchaseOrderUseCase;
  let placePoUseCase: PlacePurchaseOrderUseCase;
  let receivePoUseCase: ReceivePurchaseOrderUseCase;
  let cancelPoUseCase: CancelPurchaseOrderUseCase;

  const tenantId = 't-rep';
  const actorId = 'a-rep';
  const sourceLoc = 'LOC-CENTRAL';
  const destLoc = 'LOC-REGIONAL';
  const skuStr = 'SKU-REP-1';
  let variantIdStr: string;

  beforeEach(async () => {
    ruleRepo = new InMemoryReplenishmentRuleRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    poRepo = new InMemoryPurchaseOrderRepository();
    transferRepo = new InMemoryStockTransferRepository();
    ledgerRepo = new InMemoryLedgerRepository();

    const velocityCalc = new DemandVelocityCalculator(productRepo, ledgerRepo);
    const forecaster = new ReorderPointForecaster(velocityCalc);
    const evaluator = new ReplenishmentEvaluator(
      ruleRepo,
      inventoryRepo,
      productRepo,
      transferRepo,
      poRepo,
      forecaster
    );

    createRuleUseCase = new CreateReplenishmentRuleUseCase(ruleRepo);
    updateRuleUseCase = new UpdateReplenishmentRuleUseCase(ruleRepo);
    toggleRuleUseCase = new ToggleReplenishmentRuleUseCase(ruleRepo);
    evaluateUseCase = new EvaluateReplenishmentUseCase(evaluator);

    createPoUseCase = new CreatePurchaseOrderUseCase(poRepo);
    placePoUseCase = new PlacePurchaseOrderUseCase(poRepo, inventoryRepo, productRepo);
    receivePoUseCase = new ReceivePurchaseOrderUseCase(poRepo, inventoryRepo, productRepo, ledgerRepo);
    cancelPoUseCase = new CancelPurchaseOrderUseCase(poRepo, inventoryRepo, productRepo);

    // Seed product
    const product = new Product(new ProductId('p-rep'), 'Replenishment Product');
    const variant = product.addVariant(new Sku(skuStr), [new VariantAttribute('size', 'L')], VariantTrackingMode.Quantity);
    variantIdStr = variant.id.value;
    await productRepo.save(product);
  });

  describe('Manage Replenishment Rules', () => {
    it('should create a replenishment rule', async () => {
      const result = await createRuleUseCase.execute({
        tenantId,
        sku: skuStr,
        locationId: destLoc,
        reorderPoint: 10,
        reorderQuantity: 50,
        safetyStock: 5,
        leadTimeDays: 5,
        replenishmentType: ReplenishmentType.Transfer,
        sourceLocationId: sourceLoc,
      });

      expect(result.id).toBeDefined();
      expect(result.sku).toBe(skuStr);
      expect(result.replenishmentType).toBe(ReplenishmentType.Transfer);
      expect(result.sourceLocationId).toBe(sourceLoc);
    });

    it('should update configuration and toggle rule status', async () => {
      const created = await createRuleUseCase.execute({
        tenantId,
        sku: skuStr,
        locationId: destLoc,
        reorderPoint: 10,
        reorderQuantity: 50,
        safetyStock: 5,
        leadTimeDays: 5,
        replenishmentType: ReplenishmentType.Supplier,
        supplierId: 'SUPP-1',
      });

      const updated = await updateRuleUseCase.execute({
        id: created.id,
        reorderQuantity: 80,
        safetyStock: 8,
        leadTimeDays: 7,
        dynamicRopEnabled: true,
        reorderPoint: 12,
      });

      expect(updated.reorderQuantity).toBe(80);
      expect(updated.safetyStock).toBe(8);
      expect(updated.dynamicRopEnabled).toBe(true);
      expect(updated.reorderPoint).toBe(12);

      const disabled = await toggleRuleUseCase.execute(created.id, false);
      expect(disabled.isActive).toBe(false);
    });
  });

  describe('Replenishment Evaluation & Triggering', () => {
    it('should trigger transfer replenishment if stock falls below reorder point', async () => {
      // Create rule
      await createRuleUseCase.execute({
        tenantId,
        sku: skuStr,
        locationId: destLoc,
        reorderPoint: 20,
        reorderQuantity: 100,
        safetyStock: 5,
        leadTimeDays: 7,
        replenishmentType: ReplenishmentType.Transfer,
        sourceLocationId: sourceLoc,
      });

      // Seed regional inventory below reorder point (15 < 20)
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, destLoc);
      invItem.receiveStock(new Quantity(15));
      await inventoryRepo.save(invItem);

      // Run evaluation
      const results = await evaluateUseCase.execute(tenantId);
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].actionType).toBe('TRANSFER');
      expect(results[0].actionId).toBeDefined();

      // Verify draft Stock Transfer was created
      const transfers = await transferRepo.findAllByTenant(new TenantId(tenantId));
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe(StockTransferStatus.Draft);
      expect(transfers[0].sourceLocationId.value).toBe(sourceLoc);
      expect(transfers[0].destinationLocationId.value).toBe(destLoc);
      expect(transfers[0].items[0].quantity).toBe(100);
    });

    it('should trigger supplier purchase order draft if stock falls below reorder point', async () => {
      // Create rule
      await createRuleUseCase.execute({
        tenantId,
        sku: skuStr,
        locationId: destLoc,
        reorderPoint: 20,
        reorderQuantity: 100,
        safetyStock: 5,
        leadTimeDays: 7,
        replenishmentType: ReplenishmentType.Supplier,
        supplierId: 'SUPP-MAIN',
      });

      // Seed inventory (10 < 20)
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, destLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);

      // Run evaluation
      const results = await evaluateUseCase.execute(tenantId);
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].actionType).toBe('SUPPLIER');

      // Verify draft PO was created
      const pos = await poRepo.findAllByTenant(new TenantId(tenantId));
      expect(pos).toHaveLength(1);
      expect(pos[0].status).toBe(PurchaseOrderStatus.Draft);
      expect(pos[0].supplierId).toBe('SUPP-MAIN');
      expect(pos[0].items[0].quantity).toBe(100);
    });

    it('should skip replenishment if an open draft/ordered transfer or PO already exists to prevent duplicate ordering', async () => {
      await createRuleUseCase.execute({
        tenantId,
        sku: skuStr,
        locationId: destLoc,
        reorderPoint: 20,
        reorderQuantity: 100,
        safetyStock: 5,
        leadTimeDays: 7,
        replenishmentType: ReplenishmentType.Supplier,
        supplierId: 'SUPP-MAIN',
      });

      // Seed regional inventory (10 < 20)
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, destLoc);
      invItem.receiveStock(new Quantity(10));
      await inventoryRepo.save(invItem);

      // Trigger first time -> creates PO
      await evaluateUseCase.execute(tenantId);

      // Trigger second time -> should skip because PO draft exists
      const results2 = await evaluateUseCase.execute(tenantId);
      expect(results2[0].triggered).toBe(false);
      expect(results2[0].reason).toContain('already exists');
    });

    it('should dynamically calculate ROP if dynamic ROP is enabled', async () => {
      // Create rule
      await createRuleUseCase.execute({
        tenantId,
        sku: skuStr,
        locationId: destLoc,
        reorderPoint: 10, // will be overridden by dynamic calculation
        reorderQuantity: 100,
        safetyStock: 5,
        leadTimeDays: 5,
        replenishmentType: ReplenishmentType.Supplier,
        supplierId: 'SUPP-MAIN',
        dynamicRopEnabled: true,
      });

      // Write sales entries to ledger in last 30 days
      // Let's write 15 sales of 2 units each = 30 units total over 30 days = 1 unit per day avg
      for (let i = 0; i < 15; i++) {
        const entry = new LedgerEntry(
          new LedgerEntryId(crypto.randomUUID()),
          new TenantId(tenantId),
          new LocationId(destLoc),
          new ProductVariantId(variantIdStr),
          -2,
          ReasonCode.Sale,
          new ActorId(actorId),
          new Date()
        );
        await ledgerRepo.append(entry);
      }

      // Dynamic calculation: Daily sales (1.0) * leadTime (5) + safetyStock (5) = ROP 10
      // Let's add more sales to make daily run-rate higher (60 units consumed total = 2 units per day run-rate)
      for (let i = 0; i < 15; i++) {
        const entry = new LedgerEntry(
          new LedgerEntryId(crypto.randomUUID()),
          new TenantId(tenantId),
          new LocationId(destLoc),
          new ProductVariantId(variantIdStr),
          -2,
          ReasonCode.Sale,
          new ActorId(actorId),
          new Date()
        );
        await ledgerRepo.append(entry);
      }

      // Run rate = 60 / 30 = 2 units per day.
      // Expected dynamic ROP = 2 * 5 (leadTime) + 5 (safetyStock) = 15.

      // Seed regional inventory (12 < 15)
      const invItem = InventoryItem.createNew(crypto.randomUUID(), skuStr, destLoc);
      invItem.receiveStock(new Quantity(12));
      await inventoryRepo.save(invItem);

      // Run evaluation
      const results = await evaluateUseCase.execute(tenantId);
      expect(results[0].reorderPoint).toBe(15);
      expect(results[0].triggered).toBe(true); // 12 < 15, so triggers
    });
  });

  describe('Purchase Order Lifecycle', () => {
    it('should create, place, receive, and cancel purchase orders', async () => {
      // 1. Create
      const po = await createPoUseCase.execute({
        tenantId,
        supplierId: 'SUPP-1',
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 40 }],
      });

      expect(po.status).toBe(PurchaseOrderStatus.Draft);

      // 2. Place PO -> sets inTransit stock
      const placed = await placePoUseCase.execute(po.id);
      expect(placed.status).toBe(PurchaseOrderStatus.Ordered);

      const destInvAfterPlace = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInvAfterPlace!.inTransit.value).toBe(40);
      expect(destInvAfterPlace!.quantity.value).toBe(0);

      // 3. Receive PO -> converts inTransit to physical stock + appends ledger entry
      const received = await receivePoUseCase.execute(po.id, actorId, tenantId);
      expect(received.status).toBe(PurchaseOrderStatus.Received);

      const destInvAfterReceive = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInvAfterReceive!.inTransit.value).toBe(0);
      expect(destInvAfterReceive!.quantity.value).toBe(40);

      const ledgerEntries = await ledgerRepo.entriesFor(new ProductVariantId(variantIdStr), new LocationId(destLoc));
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].quantity).toBe(40);
      expect(ledgerEntries[0].reason).toBe(ReasonCode.PurchaseReceipt);
    });

    it('should revert inTransit stock when cancelling an Ordered PO', async () => {
      const po = await createPoUseCase.execute({
        tenantId,
        supplierId: 'SUPP-1',
        destinationLocationId: destLoc,
        items: [{ variantId: variantIdStr, quantity: 40 }],
      });

      await placePoUseCase.execute(po.id);
      const cancelled = await cancelPoUseCase.execute(po.id);
      expect(cancelled.status).toBe(PurchaseOrderStatus.Cancelled);

      const destInv = await inventoryRepo.findBySkuAndLocation(skuStr, destLoc);
      expect(destInv!.inTransit.value).toBe(0);
    });
  });
});
