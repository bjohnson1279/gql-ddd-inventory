import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../utils/security';
import { pubsub } from './pubsub';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { DataLoaders } from './dataloaders';
const BARCODE_SCANNED_TOPIC = 'BARCODE_SCANNED';

// Dummy hash for timing attack protection
const DUMMY_PASSWORD_HASH = hashPassword('dummy_password_for_timing_protection_12345');

// Login brute-force protection tracking
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number; lastAttemptAt: number }>();

// Periodic cleanup of expired entries (every 15 minutes) to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if ((now - record.firstAttemptAt) >= 15 * 60 * 1000) {
      loginAttempts.delete(key);
    }
  }
}, 15 * 60 * 1000);

import { ReceiveStockUseCase } from '../../application/useCases/ReceiveStock';
import { DispatchStockUseCase } from '../../application/useCases/DispatchStock';
import { GetStockLevelsUseCase, GetStockLevelsBySkuUseCase, GetStockLevelBySkuAndLocationUseCase } from '../../application/useCases/GetStockLevels';
import { SubmitInventoryCountUseCase } from '../../application/useCases/SubmitInventoryCount';
import { SubmitOpeningBalanceUseCase } from '../../application/useCases/SubmitOpeningBalance';
import {
  AllocateStockUseCase,
  ReleaseAllocationUseCase,
  FulfillAllocationUseCase,
  CreateInTransitUseCase,
  ReceiveInTransitUseCase
} from '../../application/useCases/ManageAllocations';

import { CreateProductUseCase, AddProductVariantUseCase, GetProductsUseCase, GetProductByIdUseCase } from '../../application/useCases/ManageProducts';
import { SellKitUseCase, AssembleKitUseCase, DisassembleKitUseCase, CreateKitUseCase } from '../../application/useCases/ManageKits';
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
import { ReasonCode } from '../../domain/enums/ReasonCode';
import { appendStockLedgerEntry } from '../utils/ledgerEntryUtils';

import { PostgresInventoryRepository } from '../persistence/PostgresInventoryRepository';
import { PostgresProductRepository } from '../persistence/PostgresProductRepository';
import { PostgresLedgerRepository } from '../persistence/PostgresLedgerRepository';
import { PostgresSerializedItemRepository } from '../persistence/PostgresSerializedItemRepository';
import { PostgresInventoryCostLayerRepository } from '../persistence/PostgresInventoryCostLayerRepository';
import { PostgresIntegrationRepository } from '../persistence/PostgresIntegrationRepository';
import { PostgresExternalMappingRepository } from '../persistence/PostgresExternalMappingRepository';
import { PostgresProductUomConfigurationRepository } from '../persistence/PostgresProductUomConfigurationRepository';
import { PostgresJournalRepository } from '../persistence/PostgresJournalRepository';
import { PostgresKitRepository } from '../persistence/PostgresKitRepository';
import { Kit } from '../../domain/entities/Kit';
import { KitId } from '../../domain/valueObjects/KitId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { PostgresWarehouseLocationRepository } from '../persistence/PostgresWarehouseLocationRepository';
import { WMSCapacityService } from '../../domain/services/WMSCapacityService';
import { WarehouseLocation } from '../../domain/entities/WarehouseLocation';
import { PostgresStockTransferRepository } from '../persistence/PostgresStockTransferRepository';
import {
  CreateStockTransferUseCase,
  DispatchStockTransferUseCase,
  ReceiveStockTransferUseCase,
  CancelStockTransferUseCase,
  GetStockTransfersUseCase,
  GetStockTransferByIdUseCase
} from '../../application/useCases/ManageStockTransfers';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { PostgresReplenishmentRuleRepository } from '../persistence/PostgresReplenishmentRuleRepository';
import { PostgresPurchaseOrderRepository } from '../persistence/PostgresPurchaseOrderRepository';
import {
  CreateReplenishmentRuleUseCase,
  UpdateReplenishmentRuleUseCase,
  ToggleReplenishmentRuleUseCase,
  EvaluateReplenishmentUseCase,
  GetReplenishmentRulesUseCase,
  CreatePurchaseOrderUseCase,
  PlacePurchaseOrderUseCase,
  ReceivePurchaseOrderUseCase,
  CancelPurchaseOrderUseCase,
  GetPurchaseOrdersUseCase,
  GetPurchaseOrderByIdUseCase
} from '../../application/useCases/ManageReplenishment';
import { DemandVelocityCalculator, ReorderPointForecaster } from '../../domain/services/ReplenishmentForecaster';
import { ReplenishmentEvaluator } from '../../domain/services/ReplenishmentEvaluator';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { ReplenishmentType } from '../../domain/enums/ReplenishmentType';

import { PutawaySuggester } from '../../domain/services/PutawaySuggester';
import { PickingRouteOptimizer } from '../../domain/services/PickingRouteOptimizer';
import { GetPutawayRecommendationsUseCase, OptimizePickingRouteUseCase } from '../../application/useCases/ManageWarehouseRouting';

import { FEFOPickingSuggester } from '../../domain/services/FEFOPickingSuggester';
import { ProductRecallService } from '../../domain/services/ProductRecallService';
import {
  UpdateVariantCostingMethodUseCase,
  ReceiveStockWithLotUseCase,
  SuggestFefoPickingUseCase,
  TraceProductRecallUseCase
} from '../../application/useCases/ManageFefoAndRecall';
import { PostgresRmaRepository } from '../persistence/PostgresRmaRepository';
import { PostgresQuarantineRepository } from '../persistence/PostgresQuarantineRepository';
import { CreateRmaUseCase, AuthorizeRmaUseCase, ReceiveRmaUseCase, ResolveQuarantineItemUseCase } from '../../application/useCases/ManageReturns';

import { DomainEventDispatcher } from '../../application/services/DomainEventDispatcher';
import { InMemoryEventBus } from '../messaging/InMemoryEventBus';
import { LowStockAlertHandler } from '../../application/eventHandlers/LowStockAlertHandler';
import { InventoryReconciledHandler } from '../../application/eventHandlers/InventoryReconciledHandler';

import { prisma, pool } from '../persistence/prismaClient';
export { prisma, pool };

// DB Repositories
const inventoryRepository = new PostgresInventoryRepository(prisma);
export const productRepository = new PostgresProductRepository(prisma);
const ledgerRepository = new PostgresLedgerRepository(prisma);
const serializedItemRepository = new PostgresSerializedItemRepository(prisma);
const costLayerRepository = new PostgresInventoryCostLayerRepository(prisma);
export const integrationRepository = new PostgresIntegrationRepository(prisma);
export const externalMappingRepository = new PostgresExternalMappingRepository(prisma);
const uomRepository = new PostgresProductUomConfigurationRepository(prisma);
const journalRepository = new PostgresJournalRepository(prisma);
const kitRepository = new PostgresKitRepository(prisma);
export const warehouseLocationRepository = new PostgresWarehouseLocationRepository(prisma);
const rmaRepository = new PostgresRmaRepository(prisma);
const quarantineRepository = new PostgresQuarantineRepository(prisma);

// Domain Services
const openingBalanceService = new OpeningBalanceService(ledgerRepository);
const serializedInventoryService = new SerializedInventoryService(serializedItemRepository, ledgerRepository);
export const inventoryService = new InventoryService(ledgerRepository);
const wmsCapacityService = new WMSCapacityService(
  inventoryRepository,
  productRepository,
  warehouseLocationRepository
);

// Messaging & Event Bus
export const eventBus = new InMemoryEventBus();
const lowStockHandler = new LowStockAlertHandler();
const reconciledHandler = new InventoryReconciledHandler();

eventBus.subscribe('LowStockAlertEvent', lowStockHandler.handle.bind(lowStockHandler));
eventBus.subscribe('InventoryReconciledEvent', reconciledHandler.handle.bind(reconciledHandler));

const eventDispatcher = new DomainEventDispatcher(eventBus);

// Use Cases
const receiveStockUseCase = new ReceiveStockUseCase(inventoryRepository, wmsCapacityService);
const dispatchStockUseCase = new DispatchStockUseCase(inventoryRepository, eventDispatcher);
const getStockLevelsUseCase = new GetStockLevelsUseCase(inventoryRepository);
const getStockLevelsBySkuUseCase = new GetStockLevelsBySkuUseCase(inventoryRepository);
const getStockLevelBySkuAndLocationUseCase = new GetStockLevelBySkuAndLocationUseCase(inventoryRepository);
const submitInventoryCountUseCase = new SubmitInventoryCountUseCase(inventoryRepository, eventDispatcher, wmsCapacityService);
const submitOpeningBalanceUseCase = new SubmitOpeningBalanceUseCase(openingBalanceService);
const allocateStockUseCase = new AllocateStockUseCase(inventoryRepository);
const releaseAllocationUseCase = new ReleaseAllocationUseCase(inventoryRepository);
const fulfillAllocationUseCase = new FulfillAllocationUseCase(inventoryRepository);
const createInTransitUseCase = new CreateInTransitUseCase(inventoryRepository);
const receiveInTransitUseCase = new ReceiveInTransitUseCase(inventoryRepository);

const createProductUseCase = new CreateProductUseCase(productRepository);
const addProductVariantUseCase = new AddProductVariantUseCase(productRepository);
const getProductsUseCase = new GetProductsUseCase(productRepository);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
const sellKitUseCase = new SellKitUseCase(inventoryService);
const createKitUseCase = new CreateKitUseCase(kitRepository);
const assembleKitUseCase = new AssembleKitUseCase(
  kitRepository,
  productRepository,
  ledgerRepository,
  costLayerRepository,
  journalRepository
);
const disassembleKitUseCase = new DisassembleKitUseCase(
  kitRepository,
  productRepository,
  ledgerRepository,
  costLayerRepository,
  journalRepository
);
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

// Stock Transfer Repositories & Use Cases
export const stockTransferRepository = new PostgresStockTransferRepository(prisma);

const createStockTransferUseCase = new CreateStockTransferUseCase(stockTransferRepository);
const dispatchStockTransferUseCase = new DispatchStockTransferUseCase(stockTransferRepository, inventoryRepository, productRepository, ledgerRepository);
const receiveStockTransferUseCase = new ReceiveStockTransferUseCase(stockTransferRepository, inventoryRepository, productRepository, ledgerRepository);
const cancelStockTransferUseCase = new CancelStockTransferUseCase(stockTransferRepository, inventoryRepository, productRepository, ledgerRepository);
const getStockTransfersUseCase = new GetStockTransfersUseCase(stockTransferRepository);
const getStockTransferByIdUseCase = new GetStockTransferByIdUseCase(stockTransferRepository);

// Replenishment Repositories
export const replenishmentRuleRepository = new PostgresReplenishmentRuleRepository(prisma);
export const purchaseOrderRepository = new PostgresPurchaseOrderRepository(prisma);

// Replenishment Services
const demandVelocityCalculator = new DemandVelocityCalculator(productRepository, ledgerRepository);
const reorderPointForecaster = new ReorderPointForecaster(demandVelocityCalculator);
const replenishmentEvaluator = new ReplenishmentEvaluator(
  replenishmentRuleRepository,
  inventoryRepository,
  productRepository,
  stockTransferRepository,
  purchaseOrderRepository,
  reorderPointForecaster
);

// Replenishment Use Cases
const createReplenishmentRuleUseCase = new CreateReplenishmentRuleUseCase(replenishmentRuleRepository);
const updateReplenishmentRuleUseCase = new UpdateReplenishmentRuleUseCase(replenishmentRuleRepository);
const toggleReplenishmentRuleUseCase = new ToggleReplenishmentRuleUseCase(replenishmentRuleRepository);
const evaluateReplenishmentUseCase = new EvaluateReplenishmentUseCase(replenishmentEvaluator);
const getReplenishmentRulesUseCase = new GetReplenishmentRulesUseCase(replenishmentRuleRepository);

const createPurchaseOrderUseCase = new CreatePurchaseOrderUseCase(purchaseOrderRepository);
const placePurchaseOrderUseCase = new PlacePurchaseOrderUseCase(purchaseOrderRepository, inventoryRepository, productRepository);
const receivePurchaseOrderUseCase = new ReceivePurchaseOrderUseCase(purchaseOrderRepository, inventoryRepository, productRepository, ledgerRepository);
const cancelPurchaseOrderUseCase = new CancelPurchaseOrderUseCase(purchaseOrderRepository, inventoryRepository, productRepository);
const getPurchaseOrdersUseCase = new GetPurchaseOrdersUseCase(purchaseOrderRepository);
const getPurchaseOrderByIdUseCase = new GetPurchaseOrderByIdUseCase(purchaseOrderRepository);

// Warehouse Routing Services & Use Cases
const putawaySuggester = new PutawaySuggester(inventoryRepository, productRepository, warehouseLocationRepository);
const pickingRouteOptimizer = new PickingRouteOptimizer(warehouseLocationRepository);

const getPutawayRecommendationsUseCase = new GetPutawayRecommendationsUseCase(putawaySuggester);
const optimizePickingRouteUseCase = new OptimizePickingRouteUseCase(pickingRouteOptimizer);

// FEFO & Product Recall Services & Use Cases
const fefoPickingSuggester = new FEFOPickingSuggester(
  costLayerRepository,
  ledgerRepository,
  productRepository
);
const productRecallService = new ProductRecallService(ledgerRepository);

const updateVariantCostingMethodUseCase = new UpdateVariantCostingMethodUseCase(productRepository);
const receiveStockWithLotUseCase = new ReceiveStockWithLotUseCase(
  inventoryRepository,
  productRepository,
  ledgerRepository,
  costLayerRepository,
  wmsCapacityService
);
const suggestFefoPickingUseCase = new SuggestFefoPickingUseCase(fefoPickingSuggester);
const traceProductRecallUseCase = new TraceProductRecallUseCase(productRecallService);

const createRmaUseCase = new CreateRmaUseCase(rmaRepository);
const authorizeRmaUseCase = new AuthorizeRmaUseCase(rmaRepository);
const receiveRmaUseCase = new ReceiveRmaUseCase(
  rmaRepository,
  inventoryRepository,
  costLayerRepository,
  quarantineRepository,
  journalRepository,
  productRepository,
  serializedItemRepository
);
const resolveQuarantineItemUseCase = new ResolveQuarantineItemUseCase(
  quarantineRepository,
  inventoryRepository,
  costLayerRepository,
  journalRepository,
  productRepository
);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL ERROR: JWT_SECRET environment variable is not set.');
}

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
if (!SHOPIFY_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL ERROR: SHOPIFY_WEBHOOK_SECRET environment variable is not set.');
}

export interface GraphQLContext {
  auth?: {
    tenantId?: string;
    actorId?: string;
    role?: string;
  };
  prisma?: PrismaClient;
  loaders?: DataLoaders;
}

function enforceRole(context: GraphQLContext, allowedRoles: string[], tenantId?: string, actorId?: string): { tenantId: string; actorId: string; role: string } {
  // If context.auth is explicitly provided, we must enforce roles even in test mode
  if (context?.auth) {
    const role = context.auth.role || 'viewer';
    if (!allowedRoles.includes(role)) {
      throw new Error(`Forbidden: You do not have permission to perform this action. Required role: one of [${allowedRoles.join(', ')}]. Current role: ${role}`);
    }
    if (tenantId && context.auth.tenantId !== tenantId) {
      throw new Error('Forbidden: Cross-tenant access is not allowed.');
    }
    if (actorId && context.auth.actorId !== actorId) {
      throw new Error('Forbidden: Cross-actor access is not allowed.');
    }
    return {
      tenantId: context.auth.tenantId || tenantId || 'tenant-1',
      actorId: context.auth.actorId || actorId || 'admin-user',
      role
    };
  }

  // Safe fallback for Jest integration unit tests which execute queries directly without tokens
  if (process.env.NODE_ENV === 'test') {
    return {
      tenantId: tenantId || 'tenant-1',
      actorId: actorId || 'admin-user',
      role: 'admin'
    };
  }

  throw new Error('Authentication required: Access token is missing or invalid.');
}

function getTenantAndActor(context: GraphQLContext, tenantId?: string, actorId?: string): { tenantId: string; actorId: string } {
  return enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId, actorId);
}

export const resolvers = {
  Product: {
    variants: async (parent: any, _: any, context: GraphQLContext) => {
      if (context?.loaders?.productVariants) {
        return context.loaders.productVariants.load(parent.id);
      }
      return parent.variants || [];
    }
  },
  ProductVariant: {
    costLayers: async (parent: any, _: any, context: GraphQLContext) => {
      if (context?.loaders?.costLayers) {
        return context.loaders.costLayers.load(parent.id);
      }
      return [];
    },
    externalMappings: async (parent: any, _: any, context: GraphQLContext) => {
      if (context?.loaders?.externalMappings) {
        return context.loaders.externalMappings.load(parent.id);
      }
      return [];
    }
  },
  Kit: {
    components: async (parent: any, _: any, context: GraphQLContext) => {
      if (context?.loaders?.kitComponents) {
        return context.loaders.kitComponents.load(parent.id);
      }
      return parent.components || [];
    }
  },
  Query: {
    inventoryItems: async (_: any, __: any, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      return await getStockLevelsUseCase.execute();
    },
    inventoryItemBySku: async (_: any, { sku }: { sku: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      return await getStockLevelsBySkuUseCase.execute(sku);
    },
    inventoryItemBySkuAndLocation: async (_: any, { sku, locationId }: { sku: string, locationId: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      return await getStockLevelBySkuAndLocationUseCase.execute(sku, locationId);
    },
    product: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const p = await getProductByIdUseCase.execute(id);
      if (!p) return null;
      return {
        id: p.id.value,
        name: p.name,
        variants: p.variants.map(v => ({
          id: v.id.value,
          sku: v.sku.value,
          trackingMode: v.trackingMode,
          costingMethod: v.costingMethod,
          attributes: v.attributes.all().map(a => ({ name: a.name, value: a.value }))
        }))
      };
    },
    products: async (_: any, __: any, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const products = await getProductsUseCase.execute();
      return products.map(p => ({
        id: p.id.value,
        name: p.name,
        variants: p.variants.map(v => ({
          id: v.id.value,
          sku: v.sku.value,
          trackingMode: v.trackingMode,
          costingMethod: v.costingMethod,
          attributes: v.attributes.all().map(a => ({ name: a.name, value: a.value }))
        }))
      }));
    },
    serializedItemBySerial: async (_: any, { serialNumber, tenantId }: { serialNumber: string; tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'warehouse_operator', 'viewer'], tenantId);
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
    shopifyConnections: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin'], tenantId);
      const connections = await getShopifyConnectionsUseCase.execute(auth.tenantId);
      return connections.map(c => ({
        id: c.id.value,
        tenantId: c.tenantId.value,
        platform: c.platform,
        storeDomain: c.storeDomain,
        isActive: c.isActive
      }));
    },
    productUomConfiguration: async (_: any, { sku }: { sku: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
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
    journalEntries: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'accountant'], tenantId);
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
    barcodeSet: async (_: any, { sku }: { sku: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'viewer']);
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
    lookupBarcode: async (_: any, { barcodeValue }: { barcodeValue: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'viewer']);
        return await lookupBarcodeUseCase.execute(barcodeValue);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    stockOnboarding: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'accountant']);
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
    stockOnboardings: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'accountant'], tenantId);
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
    },
    warehouseLocation: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const loc = await warehouseLocationRepository.findById(new LocationId(id));
      if (!loc) return null;
      return {
        id: loc.id.value,
        warehouseId: loc.warehouseId,
        zone: loc.zone,
        aisle: loc.aisle,
        rack: loc.rack,
        shelf: loc.shelf,
        bin: loc.bin,
        maxWeightGrams: loc.maxWeightGrams,
        maxVolumeCubicMeters: loc.maxVolumeCubicMeters
      };
    },
    warehouseLocations: async (_: any, __: any, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const list = await warehouseLocationRepository.findAll();
      return list.map(loc => ({
        id: loc.id.value,
        warehouseId: loc.warehouseId,
        zone: loc.zone,
        aisle: loc.aisle,
        rack: loc.rack,
        shelf: loc.shelf,
        bin: loc.bin,
        maxWeightGrams: loc.maxWeightGrams,
        maxVolumeCubicMeters: loc.maxVolumeCubicMeters
      }));
    },
    historicalStockLevel: async (_: any, { sku, locationId, timestamp }: { sku: string; locationId: string; timestamp: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const product = await productRepository.findBySku(new Sku(sku));
      if (!product) {
        throw new Error(`Product variant with SKU ${sku} not found.`);
      }
      const variant = product.findVariantBySku(sku);
      if (!variant) {
        throw new Error(`Product variant with SKU ${sku} not found.`);
      }
      return await ledgerRepository.currentQuantityAt(
        variant.id,
        new LocationId(locationId),
        new Date(timestamp)
      );
    },
    stockTransfer: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const transfer = await getStockTransferByIdUseCase.execute(id);
      if (!transfer) return null;
      return {
        id: transfer.id.value,
        tenantId: transfer.tenantId.value,
        sourceLocationId: transfer.sourceLocationId.value,
        destinationLocationId: transfer.destinationLocationId.value,
        status: transfer.status,
        referenceId: transfer.referenceId,
        dispatchedAt: transfer.dispatchedAt ? transfer.dispatchedAt.toISOString() : null,
        receivedAt: transfer.receivedAt ? transfer.receivedAt.toISOString() : null,
        createdAt: transfer.createdAt.toISOString(),
        items: transfer.items.map(i => ({
          variantId: i.variantId.value,
          quantity: i.quantity
        }))
      };
    },
    stockTransfers: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
      const list = await getStockTransfersUseCase.execute(new TenantId(auth.tenantId));
      return list.map(transfer => ({
        id: transfer.id.value,
        tenantId: transfer.tenantId.value,
        sourceLocationId: transfer.sourceLocationId.value,
        destinationLocationId: transfer.destinationLocationId.value,
        status: transfer.status,
        referenceId: transfer.referenceId,
        dispatchedAt: transfer.dispatchedAt ? transfer.dispatchedAt.toISOString() : null,
        receivedAt: transfer.receivedAt ? transfer.receivedAt.toISOString() : null,
        createdAt: transfer.createdAt.toISOString(),
        items: transfer.items.map(i => ({
          variantId: i.variantId.value,
          quantity: i.quantity
        }))
      }));
    },
    replenishmentRules: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
      const list = await getReplenishmentRulesUseCase.execute(auth.tenantId);
      return list.map(rule => ({
        id: rule.id.value,
        tenantId: rule.tenantId.value,
        sku: rule.sku.value,
        locationId: rule.locationId.value,
        reorderPoint: rule.reorderPoint,
        reorderQuantity: rule.reorderQuantity,
        safetyStock: rule.safetyStock,
        leadTimeDays: rule.leadTimeDays,
        replenishmentType: rule.replenishmentType,
        sourceLocationId: rule.sourceLocationId ? rule.sourceLocationId.value : null,
        supplierId: rule.supplierId,
        isActive: rule.isActive,
        dynamicRopEnabled: rule.dynamicRopEnabled
      }));
    },
    purchaseOrder: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const po = await getPurchaseOrderByIdUseCase.execute(id);
      if (!po) return null;
      return {
        id: po.id.value,
        tenantId: po.tenantId.value,
        supplierId: po.supplierId,
        destinationLocationId: po.destinationLocationId.value,
        status: po.status,
        items: po.items.map(i => ({
          variantId: i.variantId.value,
          quantity: i.quantity
        })),
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString()
      };
    },
    purchaseOrders: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
      const list = await getPurchaseOrdersUseCase.execute(auth.tenantId);
      return list.map(po => ({
        id: po.id.value,
        tenantId: po.tenantId.value,
        supplierId: po.supplierId,
        destinationLocationId: po.destinationLocationId.value,
        status: po.status,
        items: po.items.map(i => ({
          variantId: i.variantId.value,
          quantity: i.quantity
        })),
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString()
      }));
    },
    suggestPutawayLocations: async (_: any, { input }: { input: { sku: string; quantity: number } }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        return await getPutawayRecommendationsUseCase.execute(input.sku, input.quantity);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    optimizePickingRoute: async (_: any, { tenantId, items }: { tenantId: string; items: { sku: string; quantity: number; locationId: string }[] }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
        return await optimizePickingRouteUseCase.execute(auth.tenantId, items);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    suggestFefoPicking: async (_: any, { sku, quantity }: { sku: string; quantity: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        const suggestions = await suggestFefoPickingUseCase.execute(sku, quantity);
        return suggestions.map(s => ({
          locationId: s.locationId,
          lotNumber: s.lotNumber,
          expirationDate: s.expirationDate.toISOString(),
          quantity: s.quantity
        }));
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    traceProductRecall: async (_: any, { lotNumber }: { lotNumber: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        const dispatches = await traceProductRecallUseCase.execute(lotNumber);
        return dispatches.map(d => ({
          ledgerEntryId: d.ledgerEntryId,
          locationId: d.locationId,
          quantity: d.quantity,
          referenceId: d.referenceId || null,
          occurredAt: d.occurredAt.toISOString(),
          actorId: d.actorId
        }));
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    users: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin'], tenantId);
      const userList = await prisma.user.findMany({
        where: { tenantId },
        include: {
          userRoles: {
            include: { role: true }
          }
        }
      });
      return userList.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.userRoles.length > 0 ? u.userRoles[0].role.id : 'staff',
        active: u.active
      }));
    },
    rma: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        const rma = await rmaRepository.findById(id);
        if (!rma) return null;
        return {
          id: rma.id,
          rmaNumber: rma.rmaNumber,
          tenantId: rma.tenantId.value,
          customerId: rma.customerId,
          locationId: rma.locationId.value,
          status: rma.status,
          items: rma.items.map(item => ({
            id: item.id,
            variantId: item.variantId.value,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            unitCostCents: item.unitCostCents,
            status: item.status,
            disposition: item.disposition || null
          })),
          createdAt: rma.createdAt.toISOString(),
          updatedAt: rma.updatedAt.toISOString()
        };
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    rmas: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
        const rmas = await rmaRepository.findAllByTenant(new TenantId(auth.tenantId));
        return rmas.map(rma => ({
          id: rma.id,
          rmaNumber: rma.rmaNumber,
          tenantId: rma.tenantId.value,
          customerId: rma.customerId,
          locationId: rma.locationId.value,
          status: rma.status,
          items: rma.items.map(item => ({
            id: item.id,
            variantId: item.variantId.value,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            unitCostCents: item.unitCostCents,
            status: item.status,
            disposition: item.disposition || null
          })),
          createdAt: rma.createdAt.toISOString(),
          updatedAt: rma.updatedAt.toISOString()
        }));
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    quarantineItem: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        const item = await quarantineRepository.findById(id);
        if (!item) return null;
        return {
          id: item.id,
          variantId: item.variantId.value,
          quantity: item.quantity,
          reason: item.reason,
          status: item.status,
          locationId: item.locationId.value,
          tenantId: item.tenantId.value,
          createdAt: item.createdAt.toISOString(),
          resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null
        };
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    quarantineItems: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
        const items = await quarantineRepository.findAllByTenant(new TenantId(auth.tenantId));
        return items.map(item => ({
          id: item.id,
          variantId: item.variantId.value,
          quantity: item.quantity,
          reason: item.reason,
          status: item.status,
          locationId: item.locationId.value,
          tenantId: item.tenantId.value,
          createdAt: item.createdAt.toISOString(),
          resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null
        }));
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    notifications: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
        const list = await prisma.notification.findMany({
          where: { tenantId: auth.tenantId },
          orderBy: { createdAt: 'desc' }
        });
        return list.map((item: any) => ({
          id: item.id,
          tenantId: item.tenantId,
          title: item.title,
          message: item.message,
          type: item.type,
          isRead: item.isRead,
          createdAt: item.createdAt.toISOString()
        }));
      } catch (error: any) {
        throw new Error(error.message);
      }
    }
  },
  Mutation: {
    markNotificationAsRead: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        await prisma.notification.update({
          where: { id },
          data: { isRead: true }
        });
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    markAllNotificationsAsRead: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer'], tenantId);
        await prisma.notification.updateMany({
          where: { tenantId: auth.tenantId, isRead: false },
          data: { isRead: true }
        });
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await receiveStockUseCase.execute(sku, locationId, amount);
        await appendStockLedgerEntry(productRepository, ledgerRepository, sku, locationId, amount, ReasonCode.PurchaseReceipt, context);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await dispatchStockUseCase.execute(sku, locationId, amount);
        await appendStockLedgerEntry(productRepository, ledgerRepository, sku, locationId, -amount, ReasonCode.Sale, context);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    allocateStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await allocateStockUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    releaseAllocation: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await releaseAllocationUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    fulfillAllocation: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await fulfillAllocationUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createInTransit: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await createInTransitUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveInTransit: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await receiveInTransitUseCase.execute(sku, locationId, amount);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitInventoryCount: async (_: any, { counts }: { counts: { sku: string; locationId: string; actualQuantity: number }[] }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await submitInventoryCountUseCase.execute(counts);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitOpeningBalance: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'accountant'], input.tenantId, input.actorId);
        const onboardingId = await createStockOnboardingUseCase.execute({
          tenantId: auth.tenantId,
          locationId: input.locationId
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
    createProduct: async (_: any, { id, name }: { id: string; name: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await createProductUseCase.execute(id, name);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    addProductVariant: async (_: any, { productId, sku, attributes, trackingMode }: { productId: string; sku: string; attributes: any[]; trackingMode: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await addProductVariantUseCase.execute({ productId, sku, attributes, trackingMode });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createKit: async (_: any, { id, sku, name, components }: { id: string; sku: string; name: string; components: any[] }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await createKitUseCase.execute({ id, sku, name, components });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    sellKit: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await sellKitUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    assembleKit: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId, input.actorId);
        return await assembleKitUseCase.execute({
          ...input,
          tenantId: auth.tenantId,
          actorId: auth.actorId
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    disassembleKit: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId, input.actorId);
        return await disassembleKitUseCase.execute({
          ...input,
          tenantId: auth.tenantId,
          actorId: auth.actorId
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveSerializedItem: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await receiveSerializedItemUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    connectShopifyStore: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin'], input.tenantId);
        return await connectShopifyStoreUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    configureProductUom: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await configureProductUomUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createJournalEntry: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'accountant'], input.tenantId);
        return await createJournalEntryUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    assignBarcode: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await assignBarcodeUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    revokeBarcode: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await revokeBarcodeUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    generateInternalBarcode: async (_: any, { sku, tenantId }: { sku: string; tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], tenantId);
        return await generateInternalBarcodeUseCase.execute(sku, auth.tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchBarcodeScan: async (_: any, { rawScan, context, payload }: { rawScan: string; context: any; payload: any }, ctx: GraphQLContext) => {
      try {
        const auth = enforceRole(ctx, ['admin', 'warehouse_operator'], payload.tenantId || 'tenant-1');
        const result = await dispatchBarcodeScanUseCase.execute(rawScan, context, payload);
        
        // Publish real-time scan event to active tenant subscription channel
        pubsub.publish(`${BARCODE_SCANNED_TOPIC}_${auth.tenantId}`, {
          barcodeScanned: {
            scanValue: rawScan,
            symbology: 'unknown',
            context: String(context),
            status: 'Success',
            time: new Date().toLocaleTimeString(),
            payload: JSON.stringify(payload)
          }
        });
        
        return result;
      } catch (error: any) {
        const tenantId = ctx?.auth?.tenantId || payload?.tenantId || 'tenant-1';
        
        // Publish failure scan events to subscription channel for supervisor auditing
        pubsub.publish(`${BARCODE_SCANNED_TOPIC}_${tenantId}`, {
          barcodeScanned: {
            scanValue: rawScan,
            symbology: 'unknown',
            context: String(context),
            status: `Error: ${error.message}`,
            time: new Date().toLocaleTimeString(),
            payload: JSON.stringify(payload)
          }
        });
        
        throw new Error(error.message);
      }
    },
    createStockOnboarding: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'accountant'], input.tenantId);
        return await createStockOnboardingUseCase.execute({
          tenantId: auth.tenantId,
          locationId: input.locationId
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    saveStockOnboardingItems: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'accountant']);
        return await saveStockOnboardingItemsUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    submitStockOnboarding: async (_: any, { id, actorId }: { id: string; actorId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'accountant'], undefined, actorId);
        return await submitStockOnboardingUseCase.execute(id, auth.actorId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createWarehouseLocation: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        const loc = new WarehouseLocation(
          new LocationId(input.id),
          input.warehouseId,
          input.zone,
          input.aisle,
          input.rack,
          input.shelf,
          input.bin,
          input.maxWeightGrams,
          input.maxVolumeCubicMeters
        );
        await warehouseLocationRepository.save(loc);
        return {
          id: loc.id.value,
          warehouseId: loc.warehouseId,
          zone: loc.zone,
          aisle: loc.aisle,
          rack: loc.rack,
          shelf: loc.shelf,
          bin: loc.bin,
          maxWeightGrams: loc.maxWeightGrams,
          maxVolumeCubicMeters: loc.maxVolumeCubicMeters
        };
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    deleteWarehouseLocation: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        await warehouseLocationRepository.delete(new LocationId(id));
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createStockTransfer: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId);
        return await createStockTransferUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchStockTransfer: async (_: any, { id, actorId, tenantId }: { id: string; actorId: string; tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], tenantId, actorId);
        return await dispatchStockTransferUseCase.execute(id, auth.actorId, auth.tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveStockTransfer: async (_: any, { id, actorId, tenantId }: { id: string; actorId: string; tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], tenantId, actorId);
        return await receiveStockTransferUseCase.execute(id, auth.actorId, auth.tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    cancelStockTransfer: async (_: any, { id, actorId, tenantId }: { id: string; actorId: string; tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], tenantId, actorId);
        return await cancelStockTransferUseCase.execute(id, auth.actorId, auth.tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createReplenishmentRule: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId);
        return await createReplenishmentRuleUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    toggleReplenishmentRule: async (_: any, { id, isActive }: { id: string; isActive: boolean }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await toggleReplenishmentRuleUseCase.execute(id, isActive);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    evaluateReplenishment: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], tenantId);
        await evaluateReplenishmentUseCase.execute(auth.tenantId);
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createPurchaseOrder: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId);
        return await createPurchaseOrderUseCase.execute({ ...input, tenantId: auth.tenantId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    placePurchaseOrder: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await placePurchaseOrderUseCase.execute(id);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receivePurchaseOrder: async (_: any, { id, actorId, tenantId }: { id: string; actorId: string; tenantId: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], tenantId, actorId);
        return await receivePurchaseOrderUseCase.execute(id, auth.actorId, auth.tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    cancelPurchaseOrder: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        return await cancelPurchaseOrderUseCase.execute(id);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    updateProductVariantCostingMethod: async (_: any, { sku, costingMethod }: { sku: string; costingMethod: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        const variant = await updateVariantCostingMethodUseCase.execute(sku, costingMethod);
        return {
          id: variant.id.value,
          sku: variant.sku.value,
          trackingMode: variant.trackingMode,
          costingMethod: variant.costingMethod,
          attributes: variant.attributes.all().map(a => ({ name: a.name, value: a.value }))
        };
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveStockWithLot: async (
      _: any,
      { sku, locationId, quantity, unitCostCents, lotNumber, expirationDate }: {
        sku: string;
        locationId: string;
        quantity: number;
        unitCostCents: number;
        lotNumber: string;
        expirationDate: string;
      },
      context: GraphQLContext
    ) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        return await receiveStockWithLotUseCase.execute({
          sku,
          locationId,
          quantity,
          unitCostCents,
          lotNumber,
          expirationDate: new Date(expirationDate),
          tenantId: auth.tenantId,
          actorId: auth.actorId
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createRma: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        const rma = await createRmaUseCase.execute(input);
        return {
          id: rma.id,
          rmaNumber: rma.rmaNumber,
          tenantId: rma.tenantId.value,
          customerId: rma.customerId,
          locationId: rma.locationId.value,
          status: rma.status,
          items: rma.items.map(item => ({
            id: item.id,
            variantId: item.variantId.value,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            unitCostCents: item.unitCostCents,
            status: item.status,
            disposition: item.disposition || null
          })),
          createdAt: rma.createdAt.toISOString(),
          updatedAt: rma.updatedAt.toISOString()
        };
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    authorizeRma: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        await authorizeRmaUseCase.execute(id);
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveRma: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        await receiveRmaUseCase.execute(input);
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    resolveQuarantineItem: async (_: any, { id, resolution }: { id: string; resolution: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator']);
        await resolveQuarantineItemUseCase.execute({ quarantineItemId: id, resolution: resolution as any });
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    login: async (_: any, { tenantId, actorId, role, email, password }: { tenantId: string; actorId?: string; role?: string; email?: string; password?: string }) => {
      if (email && password) {
        const emailLower = email.toLowerCase().trim();
        const rateLimitKey = `${tenantId}:${emailLower}`;

        // Brute-force protection: check failed attempts
        const now = Date.now();
        const attemptRecord = loginAttempts.get(rateLimitKey);
        if (attemptRecord) {
          if (attemptRecord.count >= 5 && (now - attemptRecord.firstAttemptAt) < 15 * 60 * 1000) {
            throw new Error('Too many login attempts. Please try again later.');
          }
          if ((now - attemptRecord.firstAttemptAt) >= 15 * 60 * 1000) {
             loginAttempts.delete(rateLimitKey);
          }
        }

        const handleFailedAttempt = () => {
          const record = loginAttempts.get(rateLimitKey);
          if (record && (now - record.firstAttemptAt) < 15 * 60 * 1000) {
            record.count += 1;
            record.lastAttemptAt = now;
          } else {
            loginAttempts.set(rateLimitKey, { count: 1, firstAttemptAt: now, lastAttemptAt: now });
          }
          throw new Error('Invalid credentials.');
        };

        const user = await prisma.user.findFirst({
          where: { tenantId, email: emailLower },
          include: {
            userRoles: {
              include: { role: true }
            }
          }
        });
        if (!user) {
          // Timing attack protection: perform a dummy hash verification
          verifyPassword(password, DUMMY_PASSWORD_HASH);
          return handleFailedAttempt();
        }
        if (!user.active) {
          // Timing attack protection & error message leakage protection
          verifyPassword(password, DUMMY_PASSWORD_HASH);
          return handleFailedAttempt();
        }
        if (!verifyPassword(password, user.passwordHash)) {
          return handleFailedAttempt();
        }

        // Success: clear rate limit
        loginAttempts.delete(rateLimitKey);

        const userRole = user.userRoles.length > 0 ? user.userRoles[0].role.id : 'staff';
        return jwt.sign(
          { tenantId, actorId: user.id, role: userRole },
          JWT_SECRET as string,
          { expiresIn: '24h' }
        );
      }

      if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
        throw new Error('Login mutation is only available in development or test environments.');
      }
      if (!tenantId || !actorId) {
        throw new Error('Tenant ID and User ID are required.');
      }

      // Security fix: verify password even in development/test to prevent unauthorized access
      const expectedPassword = process.env.DEV_PASSWORD;
      if (!expectedPassword) {
        throw new Error('DEV_PASSWORD environment variable is not set.');
      }

      const passwordHash = crypto.createHash('sha256').update(password || '').digest();
      const expectedHash = crypto.createHash('sha256').update(expectedPassword).digest();

      if (!crypto.timingSafeEqual(passwordHash, expectedHash)) {
        throw new Error('Invalid credentials.');
      }

      const userRole = role || 'admin';
      return jwt.sign(
        { tenantId, actorId, role: userRole },
        JWT_SECRET as string,
        { expiresIn: '24h' }
      );
    },
    setup: async (_: any, { orgName, tenantId, adminName, adminEmail, adminPassword }: { orgName: string; tenantId: string; adminName: string; adminEmail: string; adminPassword: string }) => {
      // Security fix: Restrict setup mutation to non-production environments to prevent unauthorized admin creation
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Setup mutation is disabled in production environments.');
      }

      try {
        let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
          tenant = await prisma.tenant.create({
            data: { id: tenantId, name: orgName }
          });
        }

        const roles = ['admin', 'warehouse_operator', 'accountant', 'viewer'];
        for (const r of roles) {
          const roleExists = await prisma.role.findUnique({ where: { id: r } });
          if (!roleExists) {
            await prisma.role.create({
              data: { id: r, name: r.replace('_', ' ') }
            });
          }
        }

        const email = adminEmail.toLowerCase().trim();
        const existing = await prisma.user.findFirst({
          where: { tenantId, email }
        });
        if (existing) {
          throw new Error(`Admin user with email ${email} already exists for tenant.`);
        }

        const adminId = crypto.randomUUID();
        const passwordHash = hashPassword(adminPassword);
        const user = await prisma.user.create({
          data: {
            id: adminId,
            tenantId,
            email,
            passwordHash,
            name: adminName,
            active: true
          }
        });

        await prisma.userRole.create({
          data: {
            userId: adminId,
            roleId: 'admin'
          }
        });

        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    inviteUser: async (_: any, { tenantId, email, role }: { tenantId: string; email: string; role: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin'], tenantId);
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const existing = await prisma.user.findFirst({
          where: { tenantId, email: normalizedEmail }
        });
        if (existing) {
          throw new Error('User already exists.');
        }

        const userId = crypto.randomUUID();
        const tempPassword = crypto.randomBytes(6).toString('hex');
        const passwordHash = hashPassword(tempPassword);

        await prisma.user.create({
          data: {
            id: userId,
            tenantId,
            email: normalizedEmail,
            passwordHash,
            name: normalizedEmail.split('@')[0],
            active: true
          }
        });

        const roleExists = await prisma.role.findUnique({ where: { id: role } });
        if (!roleExists) {
          await prisma.role.create({
            data: { id: role, name: role.replace('_', ' ') }
          });
        }

        await prisma.userRole.create({
          data: {
            userId,
            roleId: role
          }
        });

        return {
          userId,
          temporaryPassword: tempPassword
        };
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    updateUserRole: async (_: any, { tenantId, userId, role }: { tenantId: string; userId: string; role: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin'], tenantId);
      try {
        const user = await prisma.user.findFirst({
          where: { id: userId, tenantId }
        });
        if (!user) {
          throw new Error('User not found.');
        }

        await prisma.userRole.deleteMany({
          where: { userId }
        });

        const roleExists = await prisma.role.findUnique({ where: { id: role } });
        if (!roleExists) {
          await prisma.role.create({
            data: { id: role, name: role.replace('_', ' ') }
          });
        }

        await prisma.userRole.create({
          data: {
            userId,
            roleId: role
          }
        });

        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    }
  },
  Subscription: {
    barcodeScanned: {
      subscribe: (_: any, { tenantId }: { tenantId: string }, ctx: GraphQLContext) => {
        // Enforce token check; only allow subscription to active tenant events
        const auth = enforceRole(ctx, ['admin', 'warehouse_operator'], tenantId);
        return (pubsub as any).asyncIterator(`${BARCODE_SCANNED_TOPIC}_${auth.tenantId}`);
      }
    }
  }
};


