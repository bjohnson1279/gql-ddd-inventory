import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../utils/security';
import { pubsub } from './pubsub';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { DataLoaders } from './dataloaders';
const BARCODE_SCANNED_TOPIC = 'BARCODE_SCANNED';
const STOCK_CHANGED_TOPIC = 'STOCK_CHANGED';
const WEBHOOK_FAILED_TOPIC = 'WEBHOOK_FAILED';

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
import { SellKitUseCase, AssembleKitUseCase, DisassembleKitUseCase, CreateKitUseCase, AddKitComponentUseCase } from '../../application/useCases/ManageKits';
import {
  ReceiveSerializedItemUseCase,
  SellSerializedItemUseCase,
  ReturnSerializedItemUseCase,
  RestockSerializedItemUseCase,
  WriteOffSerializedItemUseCase,
  GetSerializedItemBySerialUseCase,
  ListSerializedItemsByVariantUseCase,
  CountSerializedItemsByStatusUseCase
} from '../../application/useCases/ManageSerializedItems';
import { ConnectShopifyStoreUseCase, GetShopifyConnectionsUseCase } from '../../application/useCases/ManageShopifyConnections';
import {
  ConfigureProductUomUseCase,
  GetProductUomConfigurationUseCase,
  GetProductUomConfigurationByIdUseCase,
  AddUomConversionRuleUseCase,
  RemoveUomConversionRuleUseCase,
  SetUomUnitsUseCase
} from '../../application/useCases/ManageUoms';
import { CreateJournalEntryUseCase, GetJournalEntriesUseCase } from '../../application/useCases/ManageJournals';
import { GetTenantAccountingConfigUseCase, SaveTenantAccountingConfigUseCase } from '../../application/useCases/ManageTenantAccountingConfig';
import { GetStockValuationReportUseCase } from '../../application/useCases/GetStockValuationReport';
import { CostingMethod } from '../../domain/enums/AccountingEnums';
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
import { AutoRetryDecorator } from '../../application/decorators/AutoRetryDecorator';
import {
  CreateStockTransferUseCase,
  DispatchStockTransferUseCase,
  ReceiveStockTransferUseCase,
  CancelStockTransferUseCase,
  GetStockTransfersUseCase,
  GetStockTransferByIdUseCase
} from '../../application/useCases/ManageStockTransfers';
import {
  CalculateShippingRatesUseCase,
  PurchaseShippingLabelUseCase,
  UpdateShipmentStatusUseCase,
  GetShipmentsUseCase
} from '../../application/useCases/ManageShipping';
import { RouteOrder } from '../../application/useCases/RouteOrder';
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
import { DemandForecaster } from '../../domain/services/DemandForecaster';
import { PostgresDemandForecastRepository } from '../persistence/PostgresDemandForecastRepository';
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
import { AccountingJournalService } from '../../domain/services/AccountingJournalService';
import { SyncJournalListeners } from '../../application/eventHandlers/SyncJournalListeners';
import {
  NetSuiteJournalSync,
  XeroJournalSync,
  QuickBooksJournalSync,
  NetSuiteMappingRepository,
  XeroMappingRepository,
  QuickBooksMappingRepository
} from '../../application/services/AccountingSyncService';

import { DomainEventDispatcher } from '../../application/services/DomainEventDispatcher';
import { InMemoryEventBus } from '../messaging/InMemoryEventBus';
import { KafkaEventBus } from '../messaging/KafkaEventBus';
import { LowStockAlertHandler } from '../../application/eventHandlers/LowStockAlertHandler';
import { InventoryReconciledHandler } from '../../application/eventHandlers/InventoryReconciledHandler';
import { ShopifyStockSyncHandler } from '../../application/eventHandlers/ShopifyStockSyncHandler';

import { prisma, pool } from '../persistence/prismaClient';
export { prisma, pool };

// ── Shipping Stubs ────────────────────────────────────────────────────────────
// These are lightweight stubs for shipping functionality.
// They will be replaced once the full ManageShipping use case module is implemented.
class _ShipmentRepository {
  async save(_: any): Promise<void> {}
  async findById(_: any): Promise<any> { return null; }
  async findAll(): Promise<any[]> { return []; }
  async update(_: any): Promise<void> {}
}
class _CarrierService {
  private getDistance(origin: string, destination: string): number {
    const org = origin.toUpperCase();
    const dest = destination.toLowerCase();

    let baseDist = 1000;
    if (org.includes("EAST") && (dest.includes("ny") || dest.includes("new york") || dest.includes("10001"))) baseDist = 100;
    else if (org.includes("WEST") && (dest.includes("la") || dest.includes("los angeles") || dest.includes("ca") || dest.includes("90210"))) baseDist = 100;
    else if (org.includes("CENTRAL") && (dest.includes("chicago") || dest.includes("il") || dest.includes("60601"))) baseDist = 100;
    else if (org.includes("EAST") && (dest.includes("la") || dest.includes("ca") || dest.includes("90210"))) baseDist = 4000;
    else if (org.includes("WEST") && (dest.includes("ny") || dest.includes("new york") || dest.includes("10001"))) baseDist = 4000;

    return baseDist;
  }

  async getRates(sku: string, qty: number, dest: string, origin?: string): Promise<any[]> {
    const weightFactor = sku.length % 3 + 1;
    const baseQuantity = qty || 1;
    const distanceKm = this.getDistance(origin || "default", dest);
    const distanceCost = Math.ceil(distanceKm * 0.1);

    return [
      {
        carrier: "UPS Ground",
        serviceName: "UPS Ground",
        rateCents: Math.ceil((500 + (weightFactor * 50) + distanceCost) * baseQuantity),
        deliveryDays: distanceKm > 2000 ? 5 : 2
      },
      {
        carrier: "FedEx Express",
        serviceName: "FedEx Express",
        rateCents: Math.ceil((1500 + (weightFactor * 100) + distanceCost * 1.5) * baseQuantity),
        deliveryDays: 1
      },
      {
        carrier: "DHL Worldwide",
        serviceName: "DHL Worldwide",
        rateCents: Math.ceil((3500 + (weightFactor * 250) + distanceCost * 2) * baseQuantity),
        deliveryDays: distanceKm > 2000 ? 3 : 1
      },
      {
        carrier: "USPS Priority",
        serviceName: "USPS Priority",
        rateCents: Math.ceil((450 + (weightFactor * 35) + distanceCost * 0.8) * baseQuantity),
        deliveryDays: distanceKm > 2000 ? 6 : 3
      }
    ];
  }

  async purchaseLabel(_: any): Promise<any> { return { trackingNumber: '', labelUrl: '', cost: 0 }; }
}
// ─────────────────────────────────────────────────────────────────────────────
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
export const eventBus = (process.env.KAFKA_URL && process.env.NODE_ENV !== 'test')
  ? new KafkaEventBus(process.env.KAFKA_URL)
  : new InMemoryEventBus();
const lowStockHandler = new LowStockAlertHandler();
const reconciledHandler = new InventoryReconciledHandler();
const shopifySyncHandler = new ShopifyStockSyncHandler();

eventBus.subscribe('LowStockAlertEvent', lowStockHandler.handle.bind(lowStockHandler));
eventBus.subscribe('InventoryReconciledEvent', reconciledHandler.handle.bind(reconciledHandler));
eventBus.subscribe('ShopifyStockSyncRequested', shopifySyncHandler.handle.bind(shopifySyncHandler));

const eventDispatcher = new DomainEventDispatcher(eventBus);

// Accounting Sync Initialization
const netsuiteSync = new NetSuiteJournalSync(process.env.NETSUITE_ACCOUNT_ID || 'mock', process.env.NETSUITE_TOKEN || 'mock');
const netsuiteMappings = new NetSuiteMappingRepository(prisma);
const xeroSync = new XeroJournalSync(process.env.XERO_TENANT_ID || 'mock', process.env.XERO_ACCESS_TOKEN || 'mock');
const xeroMappings = new XeroMappingRepository(prisma);
const quickbooksSync = new QuickBooksJournalSync(process.env.QUICKBOOKS_REALM_ID || 'mock', process.env.QUICKBOOKS_ACCESS_TOKEN || 'mock');
const quickbooksMappings = new QuickBooksMappingRepository(prisma);

const syncJournalListeners = new SyncJournalListeners(
  netsuiteSync,
  netsuiteMappings,
  xeroSync,
  xeroMappings,
  quickbooksSync,
  quickbooksMappings
);

eventBus.subscribe('JournalEntryCreatedEvent', syncJournalListeners.handle.bind(syncJournalListeners));

// Use Cases
const receiveStockUseCase = AutoRetryDecorator.wrap(new ReceiveStockUseCase(inventoryRepository, wmsCapacityService));
const dispatchStockUseCase = AutoRetryDecorator.wrap(new DispatchStockUseCase(inventoryRepository, eventDispatcher));
const getStockLevelsUseCase = new GetStockLevelsUseCase(inventoryRepository);
const getStockLevelsBySkuUseCase = new GetStockLevelsBySkuUseCase(inventoryRepository);
const getStockLevelBySkuAndLocationUseCase = new GetStockLevelBySkuAndLocationUseCase(inventoryRepository);
const submitInventoryCountUseCase = AutoRetryDecorator.wrap(new SubmitInventoryCountUseCase(inventoryRepository, eventDispatcher, wmsCapacityService));
const submitOpeningBalanceUseCase = AutoRetryDecorator.wrap(new SubmitOpeningBalanceUseCase(openingBalanceService));
const allocateStockUseCase = AutoRetryDecorator.wrap(new AllocateStockUseCase(inventoryRepository));
const releaseAllocationUseCase = AutoRetryDecorator.wrap(new ReleaseAllocationUseCase(inventoryRepository));
const fulfillAllocationUseCase = AutoRetryDecorator.wrap(new FulfillAllocationUseCase(inventoryRepository));
const createInTransitUseCase = AutoRetryDecorator.wrap(new CreateInTransitUseCase(inventoryRepository));
const receiveInTransitUseCase = AutoRetryDecorator.wrap(new ReceiveInTransitUseCase(inventoryRepository));

const createProductUseCase = new CreateProductUseCase(productRepository);
const addProductVariantUseCase = new AddProductVariantUseCase(productRepository);
const getProductsUseCase = new GetProductsUseCase(productRepository);
const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
const sellKitUseCase = AutoRetryDecorator.wrap(new SellKitUseCase(inventoryService));
const createKitUseCase = new CreateKitUseCase(kitRepository);
const addKitComponentUseCase = new AddKitComponentUseCase(kitRepository);
const assembleKitUseCase = AutoRetryDecorator.wrap(new AssembleKitUseCase(
  kitRepository,
  productRepository,
  ledgerRepository,
  costLayerRepository,
  journalRepository
));
const disassembleKitUseCase = AutoRetryDecorator.wrap(new DisassembleKitUseCase(
  kitRepository,
  productRepository,
  ledgerRepository,
  costLayerRepository,
  journalRepository
));
const receiveSerializedItemUseCase = new ReceiveSerializedItemUseCase(serializedInventoryService, serializedItemRepository);
const sellSerializedItemUseCase = new SellSerializedItemUseCase(serializedInventoryService);
const returnSerializedItemUseCase = new ReturnSerializedItemUseCase(serializedItemRepository);
const restockSerializedItemUseCase = new RestockSerializedItemUseCase(serializedItemRepository);
const writeOffSerializedItemUseCase = new WriteOffSerializedItemUseCase(serializedItemRepository, costLayerRepository, journalRepository);
const getSerializedItemBySerialUseCase = new GetSerializedItemBySerialUseCase(serializedItemRepository);
const listSerializedItemsByVariantUseCase = new ListSerializedItemsByVariantUseCase(serializedItemRepository);
const countSerializedItemsByStatusUseCase = new CountSerializedItemsByStatusUseCase(serializedItemRepository);
const connectShopifyStoreUseCase = new ConnectShopifyStoreUseCase(integrationRepository);
const getShopifyConnectionsUseCase = new GetShopifyConnectionsUseCase(integrationRepository);

const configureProductUomUseCase = new ConfigureProductUomUseCase(uomRepository);
const getProductUomConfigurationUseCase = new GetProductUomConfigurationUseCase(uomRepository);
const getProductUomConfigurationByIdUseCase = new GetProductUomConfigurationByIdUseCase(uomRepository);
const addUomConversionRuleUseCase = new AddUomConversionRuleUseCase(uomRepository);
const removeUomConversionRuleUseCase = new RemoveUomConversionRuleUseCase(uomRepository);
const setUomUnitsUseCase = new SetUomUnitsUseCase(uomRepository);
const createJournalEntryUseCase = new CreateJournalEntryUseCase(journalRepository, eventDispatcher);
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
const demandForecastRepository = new PostgresDemandForecastRepository(prisma);

// Demand Forecasting Services
const demandForecaster = new DemandForecaster(
  productRepository,
  inventoryRepository,
  ledgerRepository,
  replenishmentRuleRepository,
  demandForecastRepository
);

// Replenishment Services
const demandVelocityCalculator = new DemandVelocityCalculator(productRepository, ledgerRepository);
const reorderPointForecaster = new ReorderPointForecaster(demandVelocityCalculator, productRepository, purchaseOrderRepository);
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

const shipmentRepository = new _ShipmentRepository();
const carrierService = new _CarrierService();

const calculateShippingRatesUseCase = new CalculateShippingRatesUseCase(carrierService);
const purchaseShippingLabelUseCase = new PurchaseShippingLabelUseCase(
  shipmentRepository,
  carrierService,
  inventoryRepository,
  new AccountingJournalService(journalRepository),
  eventDispatcher
);
const updateShipmentStatusUseCase = new UpdateShipmentStatusUseCase(shipmentRepository, eventDispatcher);
const getShipmentsUseCase = new GetShipmentsUseCase(shipmentRepository);
const routeOrderUseCase = new RouteOrder(inventoryRepository, carrierService);

// G2 — Tenant accounting configuration
const getTenantAccountingConfigUseCase = new GetTenantAccountingConfigUseCase(prisma);
const saveTenantAccountingConfigUseCase = new SaveTenantAccountingConfigUseCase(prisma);

// G3 — Stock valuation report
const getStockValuationReportUseCase = new GetStockValuationReportUseCase(inventoryRepository, costLayerRepository, productRepository);

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

function publishStockChange(tenantId: string, item: any) {
  if (item && item.sku) {
    pubsub.publish(`${STOCK_CHANGED_TOPIC}_${tenantId}`, {
      stockChanged: {
        sku: item.sku,
        locationId: item.locationId,
        quantity: item.quantityOnHand !== undefined ? item.quantityOnHand : (item.quantity || 0),
        allocated: item.allocated || 0,
        inTransit: item.inTransit || 0,
        version: item.version || 1
      }
    }).catch((err: any) => console.error("Error publishing stock change:", err));
  }
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
    stockVelocityReport: async (_: any, { variantId }: { variantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const results = await context.prisma!.$queryRaw`
        SELECT bucket::text, units_dispatched as "unitsDispatched", units_received as "unitsReceived", transaction_count as "transactionCount"
        FROM stock_velocity_report
        WHERE variant_id = ${variantId}::uuid
          AND tenant_id = ${auth.tenantId}::uuid
        ORDER BY bucket DESC
      `;
      return results;
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
        maxVolumeCubicMeters: loc.maxVolumeCubicMeters,
        gridX: loc.gridX,
        gridY: loc.gridY,
        width: loc.width,
        height: loc.height
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
        maxVolumeCubicMeters: loc.maxVolumeCubicMeters,
        gridX: loc.gridX,
        gridY: loc.gridY,
        width: loc.width,
        height: loc.height
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
    slottingSuggestions: async (_: any, __: any, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
        const { SlottingOptimizer } = await import('../../domain/services/SlottingOptimizer');
        const optimizer = new SlottingOptimizer(prisma);
        return await optimizer.generateSuggestions();
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
    },

    // G9/G10 — Serialized item queries
    serializedItemsByVariant: async (_: any, { variantId, tenantId }: { variantId: string; tenantId: string }, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin', 'warehouse_operator', 'viewer'], tenantId);
      const items = await listSerializedItemsByVariantUseCase.execute(variantId, auth.tenantId);
      return items.map(item => ({
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
      }));
    },
    serializedItemStatusCounts: async (_: any, { variantId }: { variantId: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const counts = await countSerializedItemsByStatusUseCase.execute(variantId);
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    },

    // G12 — UOM: getById
    productUomConfigurationById: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const config = await getProductUomConfigurationByIdUseCase.execute(id);
      if (!config) return null;
      return {
        sku: config.sku.value,
        baseUnit: { name: config.baseUnit.name, abbreviation: config.baseUnit.abbreviation, category: config.baseUnit.category },
        purchaseUnit: { name: config.purchaseUnit.name, abbreviation: config.purchaseUnit.abbreviation, category: config.purchaseUnit.category },
        saleUnit: { name: config.saleUnit.name, abbreviation: config.saleUnit.abbreviation, category: config.saleUnit.category },
        conversionRules: config.conversionRules.map(r => ({
          id: r.id.value,
          unit: { name: r.unit.name, abbreviation: r.unit.abbreviation, category: r.unit.category },
          factorToBase: r.factorToBase,
          label: r.label || null
        }))
      };
    },

    // G13 — All barcodes
    allBarcodes: async (_: any, __: any, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'viewer']);
      const assignments = await barcodeRepository.findAllAssignments();
      return assignments.map(a => ({
        id: a.id.value,
        sku: a.sku.value,
        barcode: { value: a.barcode.value, symbology: a.barcode.symbology },
        source: a.source,
        isPrimary: a.isPrimary,
        assignedAt: a.assignedAt.toISOString()
      }));
    },

    // G2 — Tenant accounting config
    tenantAccountingConfig: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'accountant'], tenantId);
      return await getTenantAccountingConfigUseCase.execute(tenantId);
    },

    // G3 — Stock valuation report
    stockValuationReport: async (_: any, { tenantId, locationId, method }: { tenantId: string; locationId?: string; method?: CostingMethod }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'accountant'], tenantId);
      return await getStockValuationReportUseCase.execute(tenantId, locationId || null, method || CostingMethod.FIFO);
    },

    // G5 — Outbox stats and dead-letter events
    outboxStats: async (_: any, __: any, context: GraphQLContext) => {
      enforceRole(context, ['admin']);
      const [pending, processing, processed, failed] = await Promise.all([
        prisma.outboxEvent.count({ where: { status: 'Pending' } }),
        prisma.outboxEvent.count({ where: { status: 'Processing' } }),
        prisma.outboxEvent.count({ where: { status: 'Processed' } }),
        prisma.outboxEvent.count({ where: { status: 'Failed' } }),
      ]);
      return { pending, processing, processed, failed, total: pending + processing + processed + failed };
    },
    deadLetterEvents: async (_: any, { limit }: { limit?: number }, context: GraphQLContext) => {
      enforceRole(context, ['admin']);
      const events = await prisma.outboxEvent.findMany({
        where: { status: 'Failed' },
        orderBy: { createdAt: 'desc' },
        take: limit || undefined
      });
      return events.map((e: any) => ({
        id: e.id,
        eventType: e.eventType,
        payload: e.payload,
        status: e.status,
        attempts: e.attempts,
        lastError: e.lastError || null,
        createdAt: e.createdAt.toISOString(),
        processedAt: e.processedAt ? e.processedAt.toISOString() : null,
        nextAttemptAt: e.nextAttemptAt.toISOString()
      }));
    },
    webhookSubscriptions: async (_: any, __: any, context: GraphQLContext) => {
      const auth = enforceRole(context, ['admin']);
      return await prisma.webhookSubscription.findMany({
        where: { tenantId: auth.tenantId }
      });
    },
    auditDiscrepancies: async (_: any, { tenantId, status }: { tenantId: string; status?: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'accountant', 'viewer'], tenantId);
      const items = await prisma.auditDiscrepancy.findMany({
        where: {
          tenantId,
          ...(status ? { status } : {})
        },
        orderBy: { occurredAt: 'desc' }
      });
      return items.map((m: any) => ({
        id: m.id,
        tenantId: m.tenantId,
        type: m.type,
        referenceId: m.referenceId,
        externalRefId: m.externalRefId || null,
        description: m.description,
        status: m.status,
        occurredAt: m.occurredAt.toISOString(),
        resolvedAt: m.resolvedAt ? m.resolvedAt.toISOString() : null,
        resolutionNotes: m.resolutionNotes || null
      }));
    },
    generateDemandForecast: async (_: any, { sku, locationId, forecastDays, trendMultiplier }: { sku: string; locationId: string; forecastDays?: number; trendMultiplier?: number }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const forecast = await demandForecaster.generateDemandForecast(
        new Sku(sku),
        new LocationId(locationId),
        forecastDays || 30,
        trendMultiplier || 1.0
      );
      return {
        id: forecast.id.value,
        sku: forecast.sku.value,
        locationId: forecast.locationId.value,
        forecastedQuantity: forecast.forecastedQuantity,
        periodStart: forecast.periodStart.toISOString(),
        periodEnd: forecast.periodEnd.toISOString(),
        confidenceLevel: forecast.confidenceLevel,
        createdAt: forecast.createdAt.toISOString()
      };
    },
    demandPlanningReport: async (_: any, { locationId }: { locationId: string }, context: GraphQLContext) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'accountant', 'viewer']);
      const report = await demandForecaster.getDemandPlanningReport(new LocationId(locationId));
      return report.map(item => ({
        sku: item.sku,
        locationId: item.locationId,
        currentStock: item.currentStock,
        averageDailySales7d: item.averageDailySales7d,
        averageDailySales30d: item.averageDailySales30d,
        averageDailySales90d: item.averageDailySales90d,
        daysOfCover: isFinite(item.daysOfCover) ? item.daysOfCover : null,
        runOutDate: item.runOutDate ? item.runOutDate.toISOString() : null,
        reorderPoint: item.reorderPoint,
        reorderQuantity: item.reorderQuantity,
        safetyStock: item.safetyStock,
        forecastedDemand30d: item.forecastedDemand30d,
        confidenceLevel: item.confidenceLevel,
        actionRequired: item.actionRequired,
        recommendedOrderQuantity: item.recommendedOrderQuantity
      }));
    },
    routeOrder: async (
      _: any,
      { sku, quantity, destinationAddress, strategyName }: { sku: string; quantity: number; destinationAddress: string; strategyName?: string },
      context: GraphQLContext
    ) => {
      enforceRole(context, ['admin', 'warehouse_operator', 'viewer']);
      try {
        return await routeOrderUseCase.execute({
          sku,
          quantity,
          destinationAddress,
          strategyName: strategyName as any
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
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
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await receiveStockUseCase.execute(sku, locationId, amount);
        await appendStockLedgerEntry(productRepository, ledgerRepository, sku, locationId, amount, ReasonCode.PurchaseReceipt, context);
        publishStockChange(auth.tenantId, result);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    dispatchStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await dispatchStockUseCase.execute(sku, locationId, amount);
        await appendStockLedgerEntry(productRepository, ledgerRepository, sku, locationId, -amount, ReasonCode.Sale, context);
        publishStockChange(auth.tenantId, result);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    allocateStock: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await allocateStockUseCase.execute(sku, locationId, amount);
        publishStockChange(auth.tenantId, result);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    releaseAllocation: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await releaseAllocationUseCase.execute(sku, locationId, amount);
        publishStockChange(auth.tenantId, result);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    fulfillAllocation: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await fulfillAllocationUseCase.execute(sku, locationId, amount);
        publishStockChange(auth.tenantId, result);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createInTransit: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await createInTransitUseCase.execute(sku, locationId, amount);
        publishStockChange(auth.tenantId, result);
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    receiveInTransit: async (_: any, { sku, locationId, amount }: { sku: string; locationId: string; amount: number }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator']);
        const result = await receiveInTransitUseCase.execute(sku, locationId, amount);
        publishStockChange(auth.tenantId, result);
        return result;
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

    // G11 — Add component to existing kit
    addKitComponent: async (_: any, { kitId, variantId, quantity }: { kitId: string; variantId: string; quantity: number }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await addKitComponentUseCase.execute({ kitId, variantId, quantity });
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

    // G9 — Serialized item lifecycle mutations
    sellSerializedItem: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId, input.actorId);
        return await sellSerializedItemUseCase.execute({ ...input, tenantId: auth.tenantId, actorId: auth.actorId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    returnSerializedItem: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId, input.actorId);
        return await returnSerializedItemUseCase.execute({ ...input, tenantId: auth.tenantId, actorId: auth.actorId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    restockSerializedItem: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'warehouse_operator'], input.tenantId, input.actorId);
        return await restockSerializedItemUseCase.execute({ ...input, tenantId: auth.tenantId, actorId: auth.actorId });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    writeOffSerializedItem: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin', 'accountant'], input.tenantId, input.actorId);
        return await writeOffSerializedItemUseCase.execute({ ...input, tenantId: auth.tenantId, actorId: auth.actorId });
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

    // G12 — UOM granular mutations
    addUomConversionRule: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await addUomConversionRuleUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    removeUomConversionRule: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await removeUomConversionRuleUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    setUomUnits: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        return await setUomUnitsUseCase.execute(input);
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
          input.maxVolumeCubicMeters,
          input.gridX !== undefined ? Number(input.gridX) : 0,
          input.gridY !== undefined ? Number(input.gridY) : 0,
          input.width !== undefined ? Number(input.width) : 1,
          input.height !== undefined ? Number(input.height) : 1
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
          maxVolumeCubicMeters: loc.maxVolumeCubicMeters,
          gridX: loc.gridX,
          gridY: loc.gridY,
          width: loc.width,
          height: loc.height
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
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }
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

        let isValidPassword = false;

        if (user) {
          isValidPassword = verifyPassword(password, user.passwordHash);
        }

        if (!user || !user.active || !isValidPassword) {
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
      throw new Error('Email and password are required.');
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
        await prisma.role.createMany({
          data: roles.map(r => ({ id: r, name: r.replace('_', ' ') })),
          skipDuplicates: true
        });

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
    },

    // G2 — Save tenant accounting config
    saveTenantAccountingConfig: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin'], input.tenantId);
        return await saveTenantAccountingConfigUseCase.execute(input);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },

    // G5 — Retry dead-letter outbox event
    retryOutboxEvent: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin']);
        const event = await prisma.outboxEvent.findUnique({ where: { id } });
        if (!event) throw new Error(`Outbox event ${id} not found.`);
        await prisma.outboxEvent.update({
          where: { id },
          data: {
            status: 'Pending',
            attempts: 0,
            lastError: null,
            nextAttemptAt: new Date()
          }
        });
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    createWebhookSubscription: async (_: any, { targetUrl, secret, eventTypes }: { targetUrl: string; secret: string; eventTypes: string[] }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin']);
        return await prisma.webhookSubscription.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: auth.tenantId,
            targetUrl,
            secret,
            eventTypes,
            isActive: true
          }
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    updateWebhookSubscription: async (_: any, { id, targetUrl, secret, eventTypes, isActive }: { id: string; targetUrl?: string; secret?: string; eventTypes?: string[]; isActive?: boolean }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin']);
        const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
        if (!sub || sub.tenantId !== auth.tenantId) {
          throw new Error(`Webhook subscription ${id} not found.`);
        }
        return await prisma.webhookSubscription.update({
          where: { id },
          data: {
            targetUrl: targetUrl !== undefined ? targetUrl : undefined,
            secret: secret !== undefined ? secret : undefined,
            eventTypes: eventTypes !== undefined ? eventTypes : undefined,
            isActive: isActive !== undefined ? isActive : undefined
          }
        });
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    deleteWebhookSubscription: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin']);
        const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
        if (!sub || sub.tenantId !== auth.tenantId) {
          throw new Error(`Webhook subscription ${id} not found.`);
        }
        await prisma.webhookSubscription.delete({ where: { id } });
        return true;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    runAudit: async (_: any, { tenantId }: { tenantId: string }, context: GraphQLContext) => {
      try {
        enforceRole(context, ['admin'], tenantId);
        const { AuditProcessorService } = await import('../../domain/services/AuditProcessorService');
        const service = new AuditProcessorService(prisma);
        return await service.runAudit(tenantId);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    resolveAuditDiscrepancy: async (_: any, { id, notes }: { id: string; notes: string }, context: GraphQLContext) => {
      try {
        const auth = enforceRole(context, ['admin']);
        const { AuditProcessorService } = await import('../../domain/services/AuditProcessorService');
        const service = new AuditProcessorService(prisma);
        return await service.resolveDiscrepancy(auth.tenantId, id, notes);
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
    },
    stockChanged: {
      subscribe: (_: any, { tenantId }: { tenantId: string }, ctx: GraphQLContext) => {
        const auth = enforceRole(ctx, ['admin', 'warehouse_operator', 'viewer'], tenantId);
        return (pubsub as any).asyncIterator(`${STOCK_CHANGED_TOPIC}_${auth.tenantId}`);
      }
    },
    webhookDeliveryFailed: {
      subscribe: (_: any, { tenantId }: { tenantId: string }, ctx: GraphQLContext) => {
        const auth = enforceRole(ctx, ['admin'], tenantId);
        return (pubsub as any).asyncIterator(`${WEBHOOK_FAILED_TOPIC}_${auth.tenantId}`);
      }
    }
  }
};


