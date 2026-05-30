import { PrismaClient } from '@prisma/client';
import { PostgresProductRepository } from '../../../src/infrastructure/persistence/PostgresProductRepository';
import { PostgresLedgerRepository } from '../../../src/infrastructure/persistence/PostgresLedgerRepository';
import { PostgresSerializedItemRepository } from '../../../src/infrastructure/persistence/PostgresSerializedItemRepository';
import { PostgresInventoryCostLayerRepository } from '../../../src/infrastructure/persistence/PostgresInventoryCostLayerRepository';
import { PostgresIntegrationRepository } from '../../../src/infrastructure/persistence/PostgresIntegrationRepository';
import { PostgresExternalMappingRepository } from '../../../src/infrastructure/persistence/PostgresExternalMappingRepository';
import { PostgresProductUomConfigurationRepository } from '../../../src/infrastructure/persistence/PostgresProductUomConfigurationRepository';
import { PostgresJournalRepository } from '../../../src/infrastructure/persistence/PostgresJournalRepository';
import { PostgresBarcodeRepository } from '../../../src/infrastructure/persistence/PostgresBarcodeRepository';
import { PostgresStockOnboardingRepository } from '../../../src/infrastructure/persistence/PostgresStockOnboardingRepository';
import { StockOnboarding } from '../../../src/domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../../src/domain/valueObjects/StockOnboardingId';
import { VariantBarcodeSet } from '../../../src/domain/entities/VariantBarcodeSet';
import { Barcode } from '../../../src/domain/valueObjects/Barcode';
import { BarcodeSymbology, BarcodeSource } from '../../../src/domain/enums/BarcodeEnums';

import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';

import { LedgerEntry } from '../../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../../src/domain/valueObjects/LedgerEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

import { SerializedItem } from '../../../src/domain/entities/SerializedItem';
import { SerializedItemId } from '../../../src/domain/valueObjects/SerializedItemId';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { SerializedItemStatus } from '../../../src/domain/enums/SerializedItemStatus';

import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';

import { IntegrationConnection } from '../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../src/domain/integrations/valueObjects/IntegrationId';
import { IntegrationPlatform, ExternalEntityType } from '../../../src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from '../../../src/domain/integrations/entities/ExternalMapping';

import { ProductUomConfiguration } from '../../../src/domain/entities/ProductUomConfiguration';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/enums/UomCategory';
import { JournalEntry } from '../../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../../src/domain/valueObjects/JournalEntryId';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { AccountingMethod, DebitCredit } from '../../../src/domain/enums/AccountingEnums';

describe('Postgres Repositories', () => {
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      product: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      productVariant: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      variantAttribute: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      serializedItem: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      serializedItemHistory: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      inventoryCostLayer: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      integrationConnection: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      externalMapping: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productUomConfiguration: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      barcode: {
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      conversionRule: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      stockOnboarding: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      stockOnboardingItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      journalEntry: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      journalLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };
  });

  describe('PostgresProductRepository', () => {
    it('should save product and variants in transaction', async () => {
      const repo = new PostgresProductRepository(prismaMock as unknown as PrismaClient);
      const product = new Product(new ProductId('p-1'), 'Test Product');
      product.addVariant(new Sku('SKU-1'), [new VariantAttribute('color', 'blue')]);

      await repo.save(product);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.product.upsert).toHaveBeenCalled();
      expect(prismaMock.productVariant.upsert).toHaveBeenCalled();
      expect(prismaMock.variantAttribute.createMany).toHaveBeenCalled();
    });

    it('should find product by id', async () => {
      const repo = new PostgresProductRepository(prismaMock as unknown as PrismaClient);
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p-1',
        name: 'Test Product',
        variants: [
          {
            id: 'v-1',
            sku: 'SKU-1',
            trackingMode: 'quantity',
            attributes: [{ name: 'color', value: 'blue' }],
          },
        ],
      });

      const product = await repo.findById(new ProductId('p-1'));
      expect(product).not.toBeNull();
      expect(product?.name).toBe('Test Product');
      expect(product?.variants).toHaveLength(1);
      expect(product?.variants[0].sku.value).toBe('SKU-1');
    });
  });

  describe('PostgresLedgerRepository', () => {
    it('should append ledger entry', async () => {
      const repo = new PostgresLedgerRepository(prismaMock as unknown as PrismaClient);
      const entry = new LedgerEntry(
        new LedgerEntryId('l-1'),
        new TenantId('t-1'),
        new LocationId('loc-1'),
        new ProductVariantId('v-1'),
        10,
        ReasonCode.OpeningBalance,
        new ActorId('act-1'),
        new Date()
      );

      await repo.append(entry);
      expect(prismaMock.ledgerEntry.create).toHaveBeenCalled();
    });

    it('should calculate current quantity', async () => {
      const repo = new PostgresLedgerRepository(prismaMock as unknown as PrismaClient);
      prismaMock.ledgerEntry.aggregate.mockResolvedValue({ _sum: { quantity: 15 } });

      const qty = await repo.currentQuantity(new ProductVariantId('v-1'), new LocationId('loc-1'));
      expect(qty).toBe(15);
    });
  });

  describe('PostgresSerializedItemRepository', () => {
    it('should save serialized item status and transition history', async () => {
      const repo = new PostgresSerializedItemRepository(prismaMock as unknown as PrismaClient);
      const item = new SerializedItem(
        new SerializedItemId('s-1'),
        new ProductVariantId('v-1'),
        new SerialNumber('SN123'),
        new TenantId('t-1'),
        new LocationId('loc-1')
      );
      item.receive(new LocationId('loc-1'), new ActorId('act-1'), 'PO-1');

      await repo.save(item);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.serializedItem.upsert).toHaveBeenCalled();
      expect(prismaMock.serializedItemHistory.createMany).toHaveBeenCalled();
    });
  });

  describe('PostgresInventoryCostLayerRepository', () => {
    it('should save cost layer', async () => {
      const repo = new PostgresInventoryCostLayerRepository(prismaMock as unknown as PrismaClient);
      const layer = new InventoryCostLayer(
        new InventoryCostLayerId('cl-1'),
        new ProductVariantId('v-1'),
        10,
        100,
        new Date()
      );

      await repo.save(layer);
      expect(prismaMock.inventoryCostLayer.upsert).toHaveBeenCalled();
    });
  });

  describe('PostgresIntegrationRepository', () => {
    it('should save connection', async () => {
      const repo = new PostgresIntegrationRepository(prismaMock as unknown as PrismaClient);
      const connection = new IntegrationConnection(
        new IntegrationId('int-1'),
        new TenantId('t-1'),
        IntegrationPlatform.Shopify,
        'test-store.myshopify.com',
        'token-123'
      );

      await repo.save(connection);
      expect(prismaMock.integrationConnection.upsert).toHaveBeenCalled();
    });

    it('should find by id', async () => {
      const repo = new PostgresIntegrationRepository(prismaMock as unknown as PrismaClient);
      prismaMock.integrationConnection.findUnique.mockResolvedValue({
        id: 'int-1',
        tenantId: 't-1',
        platform: 'shopify',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'token-123',
        isActive: true,
      });

      const connection = await repo.findById(new IntegrationId('int-1'));
      expect(connection).not.toBeNull();
      expect(connection?.storeDomain).toBe('test-store.myshopify.com');
      expect(connection?.isActive).toBe(true);
    });
  });

  describe('PostgresExternalMappingRepository', () => {
    it('should save external mapping (create case)', async () => {
      const repo = new PostgresExternalMappingRepository(prismaMock as unknown as PrismaClient);
      const mapping = new ExternalMapping(
        new TenantId('t-1'),
        new IntegrationId('int-1'),
        ExternalEntityType.Variant,
        'internal-1',
        'external-1'
      );

      prismaMock.externalMapping.findUnique.mockResolvedValue(null);
      await repo.save(mapping);
      expect(prismaMock.externalMapping.create).toHaveBeenCalled();
    });

    it('should find external mapping by external ID', async () => {
      const repo = new PostgresExternalMappingRepository(prismaMock as unknown as PrismaClient);
      prismaMock.externalMapping.findUnique.mockResolvedValue({
        tenantId: 't-1',
        integrationId: 'int-1',
        entityType: 'variant',
        internalId: 'internal-1',
        externalId: 'external-1',
      });

      const mapping = await repo.findByExternalId(
        new IntegrationId('int-1'),
        'external-1',
        ExternalEntityType.Variant
      );
      expect(mapping).not.toBeNull();
      expect(mapping?.internalId).toBe('internal-1');
    });
  });

  describe('PostgresProductUomConfigurationRepository', () => {
    it('should save UOM config and rules in transaction', async () => {
      const repo = new PostgresProductUomConfigurationRepository(prismaMock as unknown as PrismaClient);
      const base = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const config = new ProductUomConfiguration(new Sku('SKU-1'), base);
      config.addConversionRule(new UnitOfMeasure('Dozen', 'dz', UomCategory.Discrete), 12);

      await repo.save(config);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.productUomConfiguration.upsert).toHaveBeenCalled();
      expect(prismaMock.conversionRule.upsert).toHaveBeenCalled();
    });

    it('should find configuration by SKU', async () => {
      const repo = new PostgresProductUomConfigurationRepository(prismaMock as unknown as PrismaClient);
      prismaMock.productUomConfiguration.findUnique.mockResolvedValue({
        sku: 'SKU-1',
        baseUnitName: 'Each',
        baseUnitAbbreviation: 'ea',
        baseUnitCategory: 'discrete',
        purchaseUnitName: 'Dozen',
        purchaseUnitAbbreviation: 'dz',
        purchaseUnitCategory: 'discrete',
        saleUnitName: 'Each',
        saleUnitAbbreviation: 'ea',
        saleUnitCategory: 'discrete',
        conversionRules: [
          {
            id: 'rule-1',
            unitName: 'Dozen',
            unitAbbreviation: 'dz',
            unitCategory: 'discrete',
            factorToBase: 12.0,
            label: 'dz rule'
          }
        ]
      });

      const config = await repo.findBySku(new Sku('SKU-1'));
      expect(config).not.toBeNull();
      expect(config?.baseUnit.name).toBe('Each');
      expect(config?.conversionRules).toHaveLength(1);
      expect(config?.conversionRules[0].factorToBase).toBe(12.0);
    });
  });

  describe('PostgresJournalRepository', () => {
    it('should save balanced journal entry and lines in transaction', async () => {
      const repo = new PostgresJournalRepository(prismaMock as unknown as PrismaClient);
      const entry = new JournalEntry(
        new JournalEntryId('j-1'),
        new TenantId('t-1'),
        new Date(),
        'Balanced entry',
        AccountingMethod.Accrual
      );
      entry.addLine(AccountCode.fromCode('1000'), 500, DebitCredit.Debit);
      entry.addLine(AccountCode.fromCode('2000'), 500, DebitCredit.Credit);

      await repo.save(entry);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.journalEntry.upsert).toHaveBeenCalled();
      expect(prismaMock.journalLine.createMany).toHaveBeenCalled();
    });

    it('should query journal entries by tenant', async () => {
      const repo = new PostgresJournalRepository(prismaMock as unknown as PrismaClient);
      prismaMock.journalEntry.findMany.mockResolvedValue([
        {
          id: 'j-1',
          tenantId: 't-1',
          date: new Date(),
          description: 'Balanced entry',
          method: 'accrual',
          lines: [
            { accountCode: '1000', amountCents: 500, type: 'debit', memo: 'Dr' },
            { accountCode: '2000', amountCents: 500, type: 'credit', memo: 'Cr' }
          ]
        }
      ]);

      const entries = await repo.findAllByTenant(new TenantId('t-1'));
      expect(entries).toHaveLength(1);
      expect(entries[0].description).toBe('Balanced entry');
      expect(entries[0].lines).toHaveLength(2);
    });
  });

  describe('PostgresBarcodeRepository', () => {
    it('should save barcode assignments in transaction', async () => {
      const repo = new PostgresBarcodeRepository(prismaMock as unknown as PrismaClient);
      prismaMock.productVariant.findUnique.mockResolvedValue({ id: 'v-1', sku: 'SKU-1' });

      const set = new VariantBarcodeSet(new Sku('SKU-1'));
      set.assign(new Barcode(BarcodeSymbology.UPC_A, '012345678905'), BarcodeSource.Supplier, true);

      await repo.save(set);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.barcode.deleteMany).toHaveBeenCalled();
      expect(prismaMock.barcode.upsert).toHaveBeenCalled();
    });

    it('should find SKU by barcode value', async () => {
      const repo = new PostgresBarcodeRepository(prismaMock as unknown as PrismaClient);
      prismaMock.barcode.findFirst.mockResolvedValue({
        id: 'b-1',
        value: '012345678905',
        variant: { sku: 'SKU-1' }
      });

      const sku = await repo.findSkuByBarcodeValue('012345678905');
      expect(sku).not.toBeNull();
      expect(sku?.value).toBe('SKU-1');
    });

    it('should find barcode set by SKU', async () => {
      const repo = new PostgresBarcodeRepository(prismaMock as unknown as PrismaClient);
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: 'v-1',
        sku: 'SKU-1',
        barcodes: [
          {
            id: 'b-1',
            value: '012345678905',
            symbology: 'upc_a',
            source: 'supplier',
            isPrimary: true,
            assignedAt: new Date()
          }
        ]
      });

      const set = await repo.findSetBySku(new Sku('SKU-1'));
      expect(set).not.toBeNull();
      expect(set?.sku.value).toBe('SKU-1');
      expect(set?.all).toHaveLength(1);
      expect(set?.all[0].barcode.value).toBe('012345678905');
    });
  });

  describe('PostgresStockOnboardingRepository', () => {
    it('should save stock onboarding sheet and items in transaction', async () => {
      const repo = new PostgresStockOnboardingRepository(prismaMock as unknown as PrismaClient);
      const onboarding = new StockOnboarding(
        new StockOnboardingId('o-1'),
        new TenantId('t-1'),
        new LocationId('loc-1'),
        new Date()
      );
      onboarding.setItem(new ProductVariantId('v-1'), 10, 100);

      await repo.save(onboarding);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.stockOnboarding.upsert).toHaveBeenCalled();
      expect(prismaMock.stockOnboardingItem.deleteMany).toHaveBeenCalled();
      expect(prismaMock.stockOnboardingItem.createMany).toHaveBeenCalled();
    });

    it('should find onboarding sheet by ID', async () => {
      const repo = new PostgresStockOnboardingRepository(prismaMock as unknown as PrismaClient);
      prismaMock.stockOnboarding.findUnique.mockResolvedValue({
        id: 'o-1',
        tenantId: 't-1',
        locationId: 'loc-1',
        status: 'draft',
        asOfDate: new Date(),
        items: [
          {
            variantId: 'v-1',
            quantity: 10,
            unitCostCents: 100
          }
        ]
      });

      const onboarding = await repo.findById(new StockOnboardingId('o-1'));
      expect(onboarding).not.toBeNull();
      expect(onboarding?.tenantId.value).toBe('t-1');
      expect(onboarding?.items).toHaveLength(1);
      expect(onboarding?.items[0].quantity).toBe(10);
    });

    it('should find onboarding sheets by tenant', async () => {
      const repo = new PostgresStockOnboardingRepository(prismaMock as unknown as PrismaClient);
      prismaMock.stockOnboarding.findMany.mockResolvedValue([
        {
          id: 'o-1',
          tenantId: 't-1',
          locationId: 'loc-1',
          status: 'draft',
          asOfDate: new Date(),
          items: []
        }
      ]);

      const list = await repo.findAllByTenant(new TenantId('t-1'));
      expect(list).toHaveLength(1);
      expect(list[0].id.value).toBe('o-1');
    });
  });
});
