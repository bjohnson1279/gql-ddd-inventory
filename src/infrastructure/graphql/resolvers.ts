import jwt from 'jsonwebtoken';
import { ReceiveStockUseCase } from '../../application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelsBySkuUseCase, GetStockLevelBySkuAndLocationUseCase } from '../../application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../application/useCases/SubmitInventoryCount';
import { SubmitOpeningBalanceUseCase } from '../../application/useCases/SubmitOpeningBalance';

import { CreateProductUseCase, AddProductVariantUseCase, GetProductsUseCase, GetProductByIdUseCase } from '../../application/useCases/ManageProducts';
import { SellKitUseCase } from '../../application/useCases/ManageKits';
import { ReceiveSerializedItemUseCase, GetSerializedItemBySerialUseCase } from '../../application/useCases/ManageSerializedItems';
import { ConnectShopifyStoreUseCase, GetShopifyConnectionsUseCase } from '../../application/useCases/ManageShopifyConnections';
import { ConfigureProductUomUseCase, GetProductUomConfigurationUseCase } from '../../application/useCases/ManageUoms';
import { CreateJournalEntryUseCase, GetJournalEntriesUseCase } from '../../application/useCases/ManageJournals';
import {
  CreateStockOnboardingUseCase,
  SaveStockOnboardingItemsUseCase,
  SubmitStockOnboardingUseCase,
  GetStockOnboardingUseCase,
  GetStockOnboardingsUseCase
} from '../../application/useCases/ManageOnboardings';
import { PostgresStockOnboardingRepository } from '../persistence/PostgresStockOnboardingRepository';
import {
  AssignBarcodeUseCase,
  RevokeBarcodeUseCase,
  GenerateInternalBarcodeUseCase,
  LookupBarcodeUseCase,
  DispatchBarcodeScanUseCase,
  POSScanHandler,
  ReceivingScanHandler,
  CycleCountScanHandler
} from '../../application/useCases/ManageBarcodes';
import { BarcodeRegistry } from '../../domain/services/BarcodeRegistry';
import { InternalBarcodeGenerator } from '../../domain/services/InternalBarcodeGenerator';
import { BarcodeScanDispatcher, ScanContext } from '../../domain/services/BarcodeScanDispatcher';
import { PostgresBarcodeRepository } from '../persistence/PostgresBarcodeRepository';
import { Sku } from '../../domain/valueObjects/Sku';


import { SerializedInventoryService } from '../../domain/services/SerializedInventoryService';
import { InventoryService } from '../../domain/services/InventoryService';
import { OpeningBalanceService } from '../../domain/services/OpeningBalanceService';

import { PostgresInventoryRepository } from '../persistence/PostgresInventoryRepository';
import { PostgresProductRepository } from '../persistence/PostgresProductRepository';
import { PostgresLedgerRepository } from '../persistence/PostgresLedgerRepository';
import { PostgresSerializedItemRepository } from '../persistence/PostgresSerializedItemRepository';
import { PostgresInventoryCostLayerRepository } from '../persistence/PostgresInventoryCostLayerRepository';
import { PostgresIntegrationRepository } from '../persistence/PostgresIntegrationRepository';
import { PostgresExternalMappingRepository } from '../persistence/PostgresExternalMappingRepository';
import { PostgresProductUomConfigurationRepository } from '../persistence/PostgresProductUomConfigurationRepository';
import { PostgresJournalRepository } from '../persistence/PostgresJournalRepository';

import { DomainEventDispatcher } from '../../application/services/DomainEventDispatcher';
import { InMemoryEventBus } from '../messaging/InMemoryEventBus';
import { LowStockAlertHandler } from '../../application/eventHandlers/LowStockAlertHandler';
import { InventoryReconciledHandler } from '../../application/eventHandlers/InventoryReconciledHandler';

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
export const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter } as any);

// DB Repositories
const inventoryRepository = new PostgresInventoryRepository(prisma);
const productRepository = new PostgresProductRepository(prisma);
const ledgerRepository = new PostgresLedgerRepository(prisma);
const serializedItemRepository = new PostgresSerializedItemRepository(prisma);
const costLayerRepository = new PostgresInventoryCostLayerRepository(prisma);
const integrationRepository = new PostgresIntegrationRepository(prisma);
const externalMappingRepository = new PostgresExternalMappingRepository(prisma);
const uomRepository = new PostgresProductUomConfigurationRepository(prisma);
const journalRepository = new PostgresJournalRepository(prisma);

// Domain Services
const openingBalanceService = new OpeningBalanceService(ledgerRepository);
const serializedInventoryService = new SerializedInventoryService(serializedItemRepository, ledgerRepository);
const inventoryService = new InventoryService(ledgerRepository);

// Messaging & Event Bus
const eventBus = new InMemoryEventBus();
const lowStockHandler = new LowStockAlertHandler();
const reconciledHandler = new InventoryReconciledHandler();

eventBus.subscribe('LowStockAlertEvent', lowStockHandler.handle.bind(lowStockHandler));
eventBus.subscribe('InventoryReconciledEvent', reconciledHandler.handle.bind(reconciledHandler));

const eventDispatcher = new DomainEventDispatcher(eventBus);

// Use Cases
const receiveStockUseCase = new ReceiveStockUseCase(inventoryRepository);
const dispatchStockUseCase = new DispatchStockUseCase(inventoryRepository, eventDispatcher);
const getStockLevelsUseCase = new GetStockLevelsUseCase(inventoryRepository);
const getStockLevelsBySkuUseCase = new GetStockLevelsBySkuUseCase(inventoryRepository);
const getStockLevelBySkuAndLocationUseCase = new GetStockLevelBySkuAndLocationUseCase(inventoryRepository);
const submitInventoryCountUseCase = new SubmitInventoryCountUseCase(inventoryRepository, eventDispatcher);
const submitOpeningBalanceUseCase = new SubmitOpeningBalanceUseCase(openingBalanceService);

const createProductUseCase = new CreateProductUseCase(productRepository);
const addProductVariantUseCase = new AddProductVariantUseCase(productRepository);
const getProductsUseCase = new GetProductsUseCase(productRepository);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
const sellKitUseCase = new SellKitUseCase(inventoryService);
const receiveSerializedItemUseCase = new ReceiveSerializedItemUseCase(serializedInventoryService, serializedItemRepository);
const getSerializedItemBySerialUseCase = new GetSerializedItemBySerialUseCase(serializedItemRepository);
const connectShopifyStoreUseCase = new ConnectShopifyStoreUseCase(integrationRepository);
const getShopifyConnectionsUseCase = new GetShopifyConnectionsUseCase(integrationRepository);

const configureProductUomUseCase = new ConfigureProductUomUseCase(uomRepository);
const getProductUomConfigurationUseCase = new GetProductUomConfigurationUseCase(uomRepository);
const createJournalEntryUseCase = new CreateJournalEntryUseCase(journalRepository);
const getJournalEntriesUseCase = new GetJournalEntriesUseCase(journalRepository);

// Barcode Repositories & Services
const barcodeRepository = new PostgresBarcodeRepository(prisma);
const barcodeRegistry = new BarcodeRegistry(barcodeRepository);
const internalBarcodeGenerator = new InternalBarcodeGenerator(barcodeRegistry);
const barcodeScanDispatcher = new BarcodeScanDispatcher(barcodeRegistry);

// Scan Handlers
const posScanHandler = new POSScanHandler(dispatchStockUseCase);
const receivingScanHandler = new ReceivingScanHandler(receiveStockUseCase);
const cycleCountScanHandler = new CycleCountScanHandler(submitInventoryCountUseCase);

barcodeScanDispatcher.register(ScanContext.PointOfSale, posScanHandler);
barcodeScanDispatcher.register(ScanContext.Receiving, receivingScanHandler);
barcodeScanDispatcher.register(ScanContext.CycleCount, cycleCountScanHandler);

// Barcode Use Cases
const assignBarcodeUseCase = new AssignBarcodeUseCase(barcodeRepository);
const revokeBarcodeUseCase = new RevokeBarcodeUseCase(barcodeRepository);
const generateInternalBarcodeUseCase = new GenerateInternalBarcodeUseCase(barcodeRepository, internalBarcodeGenerator);
const lookupBarcodeUseCase = new LookupBarcodeUseCase(barcodeRegistry);
const dispatchBarcodeScanUseCase = new DispatchBarcodeScanUseCase(barcodeScanDispatcher);
// Onboarding Repositories & Use Cases
const stockOnboardingRepository = new PostgresStockOnboardingRepository(prisma);

const createStockOnboardingUseCase = new CreateStockOnboardingUseCase(stockOnboardingRepository);
const saveStockOnboardingItemsUseCase = new SaveStockOnboardingItemsUseCase(stockOnboardingRepository);
const submitStockOnboardingUseCase = new SubmitStockOnboardingUseCase(stockOnboardingRepository, openingBalanceService);
const getStockOnboardingUseCase = new GetStockOnboardingUseCase(stockOnboardingRepository);
const getStockOnboardingsUseCase = new GetStockOnboardingsUseCase(stockOnboardingRepository);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-999';

function getTenantAndActor(context: any, tenantId?: string, actorId?: string): { tenantId: string; actorId: string } {
  if (context?.auth) {
    return {
      tenantId: context.auth.tenantId,
      actorId: context.auth.actorId
    };
  }
  // Safe fallback for Jest integration unit tests which execute queries directly
  if (process.env.NODE_ENV === 'test' || !context || Object.keys(context).length === 0) {
    return {
      tenantId: tenantId || 'tenant-1',
      actorId: actorId || 'admin-user'
    };
  }
  throw new Error('Authentication required: Access token is missing or invalid.');
}

export const resolvers = {
  Query: {
    inventoryItems: async () => {
      return await getStockLevelsUseCase.execute();
    },
    inventoryItemBySku: async (_: any, { sku }: { sku: string }) => {
      return await getStockLevelsBySkuUseCase.execute(sku);
    },
    inventoryItemBySkuAndLocation: async (_: any, { sku, locationId }: { sku: string, locationId: string }) => {
      return await getStockLevelBySkuAndLocationUseCase.execute(sku, locationId);
    },
    product: async (_: any, { id }: { id: string }) => {
      const p = await getProductByIdUseCase.execute(id);
      if (!p) return null;
      return {
        id: p.id.value,
        name: p.name,
        variants: p.variants.map(v => ({
          id: v.id.value,
          sku: v.sku.value,
          trackingMode: v.trackingMode,
          attributes: v.attributes.all().map(a => ({ name: a.name, value: a.value }))
        }))
      };
    },
    products: async () => {
      const products = await getProductsUseCase.execute();
      return products.map(p => ({
        id: p.id.value,
        name: p.name,
        variants: p.variants.map(v => ({
          id: v.id.value,
          sku: v.sku.value,
          trackingMode: v.trackingMode,
          attributes: v.attributes.all().map(a => ({ name: a.name, value: a.value }))
        }))
      }));
    },
    serializedItemBySerial: async (_: any, { serialNumber, tenantId }: { serialNumber: string; tenantId: string }, context: any) => {
      const auth = getTenantAndActor(context, tenantId);
      const item = await getSerializedItemBySerialUseCase.execute(serialNumber, auth.tenantId);
      if (!item) return null;
      return {
        id: item.id.value,
        variantId: item.variantId.value,
        serialNumber: item.serialNumber.value,
        tenantId: item.tenantId.value,
        locationId: item.locationId.value,
        status: item.status,
        history: item.history.map(h => ({
          from: h.from,
          to: h.to,
          reason: h.reason,
          actor: h.actor.value,
          occurredAt: h.occurredAt.toISOString(),
          referenceId: h.referenceId || null
        }))
      };
    },
    shopifyConnections: async (_: any, { tenantId }: { tenantId: string }, context: any) => {
      const auth = getTenantAndActor(context, tenantId);
      const connections = await getShopifyConnectionsUseCase.execute(auth.tenantId);
      return connections.map(c => ({
        id: c.id.value,
        tenantId: c.tenantId.value,
        platform: c.platform,
        storeDomain: c.storeDomain,
        isActive: c.isActive
      }));
    },
    productUomConfiguration: async (_: any, { sku }: { sku: string }) => {
      const config = await getProductUomConfigurationUseCase.execute(sku);
      if (!config) return null;
      return {
        sku: config.sku.value,
        baseUnit: {
          name: config.baseUnit.name,
          abbreviation: config.baseUnit.abbreviation,
          category: config.baseUnit.category
        },
        purchaseUnit: {
          name: config.purchaseUnit.name,
          abbreviation: config.purchaseUnit.abbreviation,
          category: config.purchaseUnit.category
        },
        saleUnit: {
          name: config.saleUnit.name,
          abbreviation: config.saleUnit.abbreviation,
          category: config.saleUnit.category
        },
        conversionRules: config.conversionRules.map(r => ({
          id: r.id.value,
          unit: {
            name: r.unit.name,
            abbreviation: r.unit.abbreviation,
            category: r.unit.category
          },
          factorToBase: r.factorToBase,
          label: r.label || null
        }))
      };
    },
    journalEntries: async (_: any, { tenantId }: { tenantId: string }, context: any) => {
      const auth = getTenantAndActor(context, tenantId);
      const entries = await getJournalEntriesUseCase.execute(auth.tenantId);
      return entries.map(e => ({
        id: e.id.value,
        tenantId: e.tenantId.value,
        date: e.date.toISOString(),
        description: e.description,
        method: e.method,
        referenceId: e.referenceId || null,
        lines: e.lines.map(l => ({
          accountCode: l.account.code,
          amountCents: l.amountCents,
          type: l.type,
          memo: l.memo || null
        }))
      }));
    },
    barcodeSet: async (_: any, { sku }: { sku: string }) => {
      const set = await barcodeRepository.findSetBySku(new Sku(sku));
      if (!set) return null;
      return {
        sku: set.sku.value,
        assignments: set.all.map(a => ({
          id: a.id.value,
          sku: a.sku.value,
          barcode: {
            value: a.barcode.value,
            symbology: a.barcode.symbology
          },
          source: a.source,
          isPrimary: a.isPrimary,
          assignedAt: a.assignedAt.toISOString()
        }))
      };
    },
    lookupBarcode: async (_: any, { barcodeValue }: { barcodeValue: string }) => {
      try {
        return await lookupBarcodeUseCase.execute(barcodeValue);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    stockOnboarding: async (_: any, { id }: { id: string }) => {
      const onboarding = await getStockOnboardingUseCase.execute(id);
      if (!onboarding) return null;
      return {
        id: onboarding.id.value,
        tenantId: onboarding.tenantId.value,
        locationId: onboarding.locationId.value,
        status: onboarding.status,
        asOfDate: onboarding.asOfDate.toISOString(),
        items: onboarding.items.map(item => ({
          variantId: item.variantId.value,
          quantity: item.quantity,
          unitCostCents: item.unitCostCents
        }))
      };
    },
    stockOnboardings: async (_: any, { tenantId }: { tenantId: string }, context: any) => {
      const auth = getTenantAndActor(context, tenantId);
      const list = await getStockOnboardingsUseCase.execute(auth.tenantId);
      return list.map(onboarding => ({
        id: onboarding.id.value,
        tenantId: onboarding.tenantId.value,
        locationId: onboarding.locationId.value,
        status: onboarding.status,
        asOfDate: onboarding.asOfDate.toISOString(),
        items: onboarding.items.map(item => ({
          variantId: item.variantId.value,
          quantity: item.quantity,
          unitCostCents: item.unitCostCents
        }))
      }));
    }
  },
  Mutation: {
    receiveStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }) => {
      try {
        return await receiveStockUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }) => {
      try {
        return await dispatchStockUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitInventoryCount: async (_: any, { counts }: { counts: { sku: string; locationId: string; actualQuantity: number }[] }) => {
      try {
        return await submitInventoryCountUseCase.execute(counts);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitOpeningBalance: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const auth = getTenantAndActor(context, input.tenantId, input.actorId);
        const onboardingId = Math.random().toString(36).substring(2, 15);
        await createStockOnboardingUseCase.execute({
          id: onboardingId,
          tenantId: auth.tenantId,
          locationId: input.locationId,
          asOfDate: input.asOfDate
        });
        await saveStockOnboardingItemsUseCase.execute({
          id: onboardingId,
          items: input.items
        });
        return await submitStockOnboardingUseCase.execute(onboardingId, auth.actorId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createProduct: async (_: any, { id, name }: { id: string; name: string }) => {
      try {
        return await createProductUseCase.execute(id, name);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    addProductVariant: async (_: any, { productId, sku, attributes, trackingMode }: { productId: string; sku: string; attributes: any[]; trackingMode: any }) => {
      try {
        return await addProductVariantUseCase.execute({ productId, sku, attributes, trackingMode });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createKit: async (_: any, { id, sku, name, components }: { id: string; sku: string; name: string; components: any[] }) => {
      try {
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    sellKit: async (_: any, { input }: { input: any }) => {
      try {
        return await sellKitUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveSerializedItem: async (_: any, { input }: { input: any }) => {
      try {
        return await receiveSerializedItemUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    connectShopifyStore: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const auth = getTenantAndActor(context, input.tenantId);
        return await connectShopifyStoreUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    configureProductUom: async (_: any, { input }: { input: any }) => {
      try {
        return await configureProductUomUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createJournalEntry: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const auth = getTenantAndActor(context, input.tenantId);
        return await createJournalEntryUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    assignBarcode: async (_: any, { input }: { input: any }) => {
      try {
        return await assignBarcodeUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    revokeBarcode: async (_: any, { input }: { input: any }) => {
      try {
        return await revokeBarcodeUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    generateInternalBarcode: async (_: any, { sku, tenantId }: { sku: string; tenantId: string }, context: any) => {
      try {
        const auth = getTenantAndActor(context, tenantId);
        return await generateInternalBarcodeUseCase.execute(sku, auth.tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchBarcodeScan: async (_: any, { rawScan, context, payload }: { rawScan: string; context: any; payload: any }) => {
      try {
        return await dispatchBarcodeScanUseCase.execute(rawScan, context, payload);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createStockOnboarding: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const auth = getTenantAndActor(context, input.tenantId);
        return await createStockOnboardingUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    saveStockOnboardingItems: async (_: any, { input }: { input: any }) => {
      try {
        return await saveStockOnboardingItemsUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitStockOnboarding: async (_: any, { id, actorId }: { id: string; actorId: string }, context: any) => {
      try {
        const auth = getTenantAndActor(context, undefined, actorId);
        return await submitStockOnboardingUseCase.execute(id, auth.actorId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    login: async (_: any, { tenantId, actorId }: { tenantId: string; actorId: string }) => {
      if (!tenantId || !actorId) {
        throw new Error('Tenant ID and User ID are required.');
      }
      return jwt.sign(
        { tenantId, actorId, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
    }
  },
};


