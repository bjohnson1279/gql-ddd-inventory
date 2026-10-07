import { PostgresInventoryRepository } from "../../../src/infrastructure/persistence/PostgresInventoryRepository";
import { PostgresLedgerRepository } from "../../../src/infrastructure/persistence/PostgresLedgerRepository";
import { PostgresProductRepository } from "../../../src/infrastructure/persistence/PostgresProductRepository";
import { Product } from "../../../src/domain/entities/Product";
import { ProductId } from "../../../src/domain/valueObjects/ProductId";
import { ProductVariant } from "../../../src/domain/entities/ProductVariant";
import { VariantAttribute } from "../../../src/domain/valueObjects/VariantAttribute";
import { InventoryItem } from "../../../src/domain/entities/InventoryItem";
import { Sku } from "../../../src/domain/valueObjects/Sku";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { LedgerEntry } from "../../../src/domain/entities/LedgerEntry";
import { LedgerEntryId } from "../../../src/domain/valueObjects/LedgerEntryId";
import { ProductVariantId } from "../../../src/domain/valueObjects/ProductVariantId";
import { TenantId } from "../../../src/domain/valueObjects/TenantId";
import { ActorId } from "../../../src/domain/valueObjects/ActorId";
import { ReasonCode } from "../../../src/domain/enums/ReasonCode";
import { ConcurrencyError } from "../../../src/domain/exceptions/DomainErrors";

describe("Postgres repositories integration", () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      inventoryItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
        createMany: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      outboxEvent: {
        createMany: jest.fn(),
      },
      product: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      variantAttribute: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $executeRaw: jest.fn(),
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      }),
    };
  });

  describe("PostgresInventoryRepository", () => {
    let repo: PostgresInventoryRepository;

    beforeEach(() => {
      repo = new PostgresInventoryRepository(mockPrisma);
    });

    it("should find inventory item by ID", async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({
        id: "item-1",
        sku: "SKU-1",
        locationId: "loc-1",
        quantity: 10,
        allocated: 2,
        inTransit: 1,
        version: 5,
      });

      const result = await repo.findById("item-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("item-1");
      expect(result!.sku.value).toBe("SKU-1");
      expect(result!.locationId.value).toBe("loc-1");
      expect(result!.quantity.value).toBe(10);
      expect(result!.allocated.value).toBe(2);
      expect(result!.inTransit.value).toBe(1);
      expect(result!.version).toBe(5);
    });

    it("should find inventory items by SKU", async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          sku: "SKU-1",
          locationId: "loc-1",
          quantity: 10,
          allocated: 0,
          inTransit: 0,
          version: 1,
        },
      ]);

      const result = await repo.findBySku("SKU-1");
      expect(result).toHaveLength(1);
      expect(result[0].sku.value).toBe("SKU-1");
    });

    it("should find inventory item by SKU and Location", async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({
        id: "item-1",
        sku: "SKU-1",
        locationId: "loc-1",
        quantity: 10,
        allocated: 0,
        inTransit: 0,
        version: 1,
      });

      const result = await repo.findBySkuAndLocation("SKU-1", "loc-1");
      expect(result).not.toBeNull();
      expect(result!.sku.value).toBe("SKU-1");
      expect(result!.locationId.value).toBe("loc-1");
    });

    it("should find batch SKU and Location pairs", async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          sku: "SKU-1",
          locationId: "loc-1",
          quantity: 10,
          allocated: 0,
          inTransit: 0,
          version: 1,
        },
      ]);

      const result = await repo.findBySkuAndLocationBatch([{ sku: "SKU-1", locationId: "loc-1" }]);
      expect(result).toHaveLength(1);
    });

    it("should return empty array for empty SKU and Location batch request", async () => {
      const result = await repo.findBySkuAndLocationBatch([]);
      expect(result).toEqual([]);
    });

    it("should find items by Location", async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          sku: "SKU-1",
          locationId: "loc-1",
          quantity: 10,
          allocated: 0,
          inTransit: 0,
          version: 1,
        },
      ]);

      const result = await repo.findByLocation("loc-1");
      expect(result).toHaveLength(1);
    });

    it("should find all items", async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          sku: "SKU-1",
          locationId: "loc-1",
          quantity: 10,
          allocated: 0,
          inTransit: 0,
          version: 1,
        },
      ]);

      const result = await repo.findAll();
      expect(result).toHaveLength(1);
    });

    it("should create new inventory item if not exists in database during save", async () => {
      const item = new InventoryItem("item-1", new Sku("SKU-1"), new LocationId("loc-1"), new Quantity(10), new Quantity(0), new Quantity(0), 1);
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);

      await repo.save(item);

      expect(mockPrisma.inventoryItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "item-1",
          sku: "SKU-1",
          locationId: "loc-1",
          quantity: 10,
        }),
      });
    });

    it("should update existing inventory item and check version concurrency", async () => {
      const item = new InventoryItem("item-1", new Sku("SKU-1"), new LocationId("loc-1"), new Quantity(15), new Quantity(0), new Quantity(0), 2);
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({ id: "item-1", version: 1 });
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });

      await repo.save(item);

      expect(mockPrisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-1", version: 1 },
        data: expect.objectContaining({
          quantity: 15,
          version: 2,
        }),
      });
    });

    it("should throw ConcurrencyError if updateMany count is 0", async () => {
      const item = new InventoryItem("item-1", new Sku("SKU-1"), new LocationId("loc-1"), new Quantity(15), new Quantity(0), new Quantity(0), 2);
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({ id: "item-1", version: 1 });
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.save(item)).rejects.toThrow(ConcurrencyError);
    });

    describe("saveBatch", () => {
      it("should do nothing when passing empty array", async () => {
        await repo.saveBatch([]);
        expect(mockPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
      });

      it("should categorize items to create and items to update without intermediate array allocation", async () => {
        const item1 = new InventoryItem("item-1", new Sku("SKU-1"), new LocationId("loc-1"), new Quantity(10), new Quantity(0), new Quantity(0), 1);
        const item2 = new InventoryItem("item-2", new Sku("SKU-2"), new LocationId("loc-1"), new Quantity(20), new Quantity(0), new Quantity(0), 2);

        mockPrisma.inventoryItem.findMany.mockResolvedValue([{ id: "item-2" }]);
        mockPrisma.inventoryItem.createMany = jest.fn().mockResolvedValue({ count: 1 });
        mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ id: "item-2" }]);

        await repo.saveBatch([item1, item2]);

        expect(mockPrisma.inventoryItem.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({ id: "item-1", sku: "SKU-1", quantity: 10 }),
          ],
        });
        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      });
    });
  });

  describe("PostgresProductRepository", () => {
    let repo: PostgresProductRepository;

    beforeEach(() => {
      repo = new PostgresProductRepository(mockPrisma);
    });

    it("should save new product with variants and attributes in batch", async () => {
      const productId = new ProductId("11111111-1111-1111-1111-111111111111");
      const product = new Product(productId, "Test Product");
      const variant = product.addVariant(new Sku("SKU-PROD-1"), [new VariantAttribute("Color", "Red")]);

      mockPrisma.product.upsert.mockResolvedValue({});
      mockPrisma.variantAttribute.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productVariant.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productVariant.findMany.mockResolvedValue([]); // non-existing variant
      mockPrisma.productVariant.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.variantAttribute.createMany.mockResolvedValue({ count: 1 });

      await repo.save(product);

      expect(mockPrisma.product.upsert).toHaveBeenCalledWith({
        where: { id: "11111111-1111-1111-1111-111111111111" },
        create: {
          id: "11111111-1111-1111-1111-111111111111",
          name: "Test Product",
        },
        update: {
          name: "Test Product",
        },
      });

      expect(mockPrisma.productVariant.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            id: variant.id.value,
            productId: "11111111-1111-1111-1111-111111111111",
            sku: "SKU-PROD-1",
          }),
        ],
      });

      expect(mockPrisma.variantAttribute.createMany).toHaveBeenCalledWith({
        data: [
          {
            variantId: variant.id.value,
            name: "Color",
            value: "Red",
          },
        ],
      });
    });

    it("should batch update existing variants using raw SQL", async () => {
      const productId = new ProductId("11111111-1111-1111-1111-111111111111");
      const product = new Product(productId, "Test Product");
      const variant = product.addVariant(new Sku("SKU-PROD-1"), [new VariantAttribute("Size", "Large")]);

      mockPrisma.product.upsert.mockResolvedValue({});
      mockPrisma.variantAttribute.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productVariant.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productVariant.findMany.mockResolvedValue([{ id: variant.id.value }]); // existing variant
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.variantAttribute.createMany.mockResolvedValue({ count: 1 });

      await repo.save(product);

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect(mockPrisma.variantAttribute.createMany).toHaveBeenCalledWith({
        data: [
          {
            variantId: variant.id.value,
            name: "Size",
            value: "Large",
          },
        ],
      });
    });
  });

  describe("PostgresLedgerRepository", () => {
    let repo: PostgresLedgerRepository;

    beforeEach(() => {
      repo = new PostgresLedgerRepository(mockPrisma);
    });

    it("should append a ledger entry successfully", async () => {
      const entry = new LedgerEntry(
        new LedgerEntryId("ent-1"),
        new TenantId("ten-1"),
        new LocationId("loc-1"),
        new ProductVariantId("var-1"),
        10,
        ReasonCode.PurchaseReceipt,
        new ActorId("act-1"),
        new Date()
      );

      await repo.append(entry);

      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "ent-1",
          tenantId: "ten-1",
          variantId: "var-1",
          locationId: "loc-1",
          quantity: 10,
        }),
      });
    });

    it("should append a batch of ledger entries successfully", async () => {
      const entry = new LedgerEntry(
        new LedgerEntryId("ent-1"),
        new TenantId("ten-1"),
        new LocationId("loc-1"),
        new ProductVariantId("var-1"),
        10,
        ReasonCode.PurchaseReceipt,
        new ActorId("act-1"),
        new Date()
      );

      await repo.appendBatch([entry]);

      expect(mockPrisma.ledgerEntry.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            id: "ent-1",
            tenantId: "ten-1",
            variantId: "var-1",
            locationId: "loc-1",
            quantity: 10,
          }),
        ],
      });
    });

    it("should return correct aggregate sum for currentQuantity", async () => {
      mockPrisma.ledgerEntry.aggregate.mockResolvedValue({
        _sum: { quantity: 15 },
      });

      const qty = await repo.currentQuantity(new ProductVariantId("var-1"), new LocationId("loc-1"));
      expect(qty).toBe(15);
      expect(mockPrisma.ledgerEntry.aggregate).toHaveBeenCalled();
    });

    it("should return correct aggregate sum for currentQuantityAt timestamp", async () => {
      mockPrisma.ledgerEntry.aggregate.mockResolvedValue({
        _sum: { quantity: 8 },
      });

      const time = new Date();
      const qty = await repo.currentQuantityAt(new ProductVariantId("var-1"), new LocationId("loc-1"), time);
      expect(qty).toBe(8);
      expect(mockPrisma.ledgerEntry.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { lte: time },
          }),
        })
      );
    });

    it("should return current quantities map for batch variants request", async () => {
      mockPrisma.ledgerEntry.groupBy.mockResolvedValue([
        { variantId: "var-1", _sum: { quantity: 5 } },
        { variantId: "var-2", _sum: { quantity: 12 } },
      ]);

      const map = await repo.currentQuantities(
        [new ProductVariantId("var-1"), new ProductVariantId("var-2")],
        new LocationId("loc-1")
      );

      expect(map.get("var-1")).toBe(5);
      expect(map.get("var-2")).toBe(12);
    });
  });
});
