import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { resolvers } from '../../infrastructure/graphql/resolvers';
import { globalPrisma, getTenantPrisma } from '../../infrastructure/persistence/prismaClient';
import { createDataLoaders } from '../../infrastructure/graphql/dataloaders';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dummy_jwt_secret';
const PYTHON_SIDECAR_URL = process.env.PYTHON_SIDECAR_URL || 'http://python-sidecar:5000/optimize';

const typeDefs = parse(`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0",
          import: ["@key", "@external", "@requires", "@provides"])

  enum RMAStatus {
    REQUESTED
    AUTHORIZED
    RECEIVED
    COMPLETED
    REJECTED
  }

  enum RMADisposition {
    RESTOCK
    SCRAP
    QUARANTINE
  }

  enum RMAItemStatus {
    PENDING
    RECEIVED
    REJECTED
  }

  enum QuarantineStatus {
    QUARANTINED
    RESTOCKED
    SCRAPPED
    RTV
  }

  type RmaItem {
    id: ID!
    variantId: ID!
    quantity: Int!
    receivedQuantity: Int!
    unitCostCents: Int!
    status: RMAItemStatus!
    disposition: RMADisposition
  }

  type Rma {
    id: ID!
    rmaNumber: String!
    tenantId: ID!
    customerId: String!
    locationId: ID!
    status: RMAStatus!
    items: [RmaItem!]!
    createdAt: String!
    updatedAt: String!
  }

  type QuarantineItem {
    id: ID!
    variantId: ID!
    quantity: Int!
    reason: String!
    status: QuarantineStatus!
    locationId: ID!
    tenantId: ID!
    createdAt: String!
    resolvedAt: String
  }

  type OutboxStats {
    pending: Int!
    processing: Int!
    processed: Int!
    failed: Int!
    total: Int!
  }

  type OutboxEvent {
    id: ID!
    eventType: String!
    payload: String!
    status: String!
    attempts: Int!
    lastError: String
    createdAt: String!
    processedAt: String
    nextAttemptAt: String!
  }

  type WebhookSubscription {
    id: ID!
    tenantId: String!
    targetUrl: String!
    secret: String!
    eventTypes: [String!]!
    isActive: Boolean!
    createdAt: String!
  }

  type WebhookDelivery {
    id: ID!
    tenantId: String!
    subscriptionId: String!
    eventType: String!
    payload: String!
    status: String!
    attempts: Int!
    lastError: String
    nextAttemptAt: String!
    processedAt: String
    createdAt: String!
  }

  enum StockOnboardingStatus {
    draft
    submitted
  }

  type InventoryItem {
    id: ID!
    sku: String!
    locationId: String!
    tenantId: String!
    quantity: Int!
    allocated: Int!
    inTransit: Int!
    lowStockThreshold: Int!
    version: Int!
  }

  type LedgerEntry {
    id: ID!
    tenantId: ID!
    locationId: String!
    variantId: ID!
    quantity: Int!
    reason: String!
    actorId: ID!
    occurredAt: String!
    referenceId: String
    metadata: String
    createdAt: String!
  }

  type WarehouseLocation @key(fields: "id") {
    id: ID!
    warehouseId: String!
    zone: String!
    aisle: String!
    rack: String!
    shelf: String!
    bin: String!
    maxWeightGrams: Int!
    maxVolumeCubicMeters: Float!
    gridX: Int!
    gridY: Int!
    width: Int!
    height: Int!
    createdAt: String!
  }

  type StockTransfer {
    id: ID!
    tenantId: ID!
    sku: String!
    sourceLocationId: String!
    destinationLocationId: String!
    quantity: Int!
    status: String!
    actorId: ID!
    createdAt: String!
    updatedAt: String!
  }

  type ReplenishmentRule {
    id: ID!
    tenantId: ID!
    sku: String!
    locationId: String!
    reorderPoint: Int!
    reorderQuantity: Int!
    safetyStock: Int!
    dynamicRopEnabled: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type LowStockAlert {
    sku: String!
    locationId: String!
    currentStock: Int!
    reorderPoint: Int!
    recommendedQuantity: Int!
  }

  type SerializedItem {
    id: ID!
    serialNumber: String!
    sku: String!
    status: String!
    locationId: String!
    tenantId: String!
    registeredAt: String!
    transitions: [StatusTransition!]!
  }

  type StatusTransition {
    id: ID!
    serializedItemId: ID!
    fromStatus: String!
    toStatus: String!
    reason: String
    transitionedAt: String!
    actorId: ID!
    referenceId: String
  }

  type ComplianceLedgerEntry {
    id: ID!
    sequenceNumber: Int!
    tenantId: String!
    eventType: String!
    payload: String!
    timestamp: String!
    previousHash: String!
    hash: String!
    signature: String!
  }

  type PurchaseOrderItem {
    id: ID!
    purchaseOrderId: ID!
    variantId: ID!
    quantity: Int!
    receivedQuantity: Int!
    unitCostCents: Int!
  }

  type PurchaseOrder {
    id: ID!
    purchaseOrderNumber: String!
    vendorId: String!
    tenantId: ID!
    status: String!
    locationId: ID!
    createdAt: String!
    updatedAt: String!
    items: [PurchaseOrderItem!]!
  }

  type AuditSummary {
    shopifyDiscrepancies: Int!
    accountingDiscrepancies: Int!
  }

  type UserDTO {
    id: ID!
    email: String!
    name: String!
    role: String!
    active: Boolean!
  }

  type UserInvitationResult {
    userId: ID!
    temporaryPassword: String!
  }

  type DemandForecast {
    id: ID!
    sku: String!
    locationId: String!
    forecastedQuantity: Int!
    periodStart: String!
    periodEnd: String!
    confidenceLevel: Float!
    createdAt: String!
  }

  type DemandPlanningReportItem {
    sku: String!
    locationId: String!
    currentStock: Int!
    averageDailySales7d: Float!
    averageDailySales30d: Float!
    averageDailySales90d: Float!
    daysOfCover: Float
    runOutDate: String
    reorderPoint: Int!
    reorderQuantity: Int!
    safetyStock: Int!
    forecastedDemand30d: Int!
    confidenceLevel: Float!
    actionRequired: Boolean!
    recommendedOrderQuantity: Int!
  }

  type CarrierRate {
    carrier: String!
    serviceName: String!
    rateCents: Int!
    deliveryDays: Int!
  }

  type FulfillmentAllocation {
    locationId: String!
    quantity: Int!
  }

  type FulfillmentPlan {
    allocations: [FulfillmentAllocation!]!
    estimatedShippingCostCents: Int!
    totalDistanceKm: Float!
    splitCount: Int!
    score: Float!
  }

  type Shipment {
    id: ID!
    tenantId: ID!
    variantId: ID!
    quantity: Int!
    status: String!
    trackingNumber: String
    carrier: String
    labelUrl: String
    createdAt: String!
  }

  type StockVelocityBucket {
    bucket: String!
    unitsDispatched: Int!
    unitsReceived: Int!
    transactionCount: Int!
  }

  type AuditDiscrepancy {
    id: ID!
    tenantId: ID!
    type: String!
    referenceId: String!
    externalRefId: String
    description: String!
    status: String!
    occurredAt: String!
    resolvedAt: String
    resolutionNotes: String
  }

  type ProductVariant @key(fields: "id") {
    id: ID! @external
  }

  type SlottingSuggestion {
    sku: String!
    currentLocationId: String!
    currentDistance: Float!
    currentVelocity: Float!
    recommendedLocationId: String!
    recommendedDistance: Float!
    potentialSwapSku: String
    estimatedSavings: Float!
  }

  input CreateRmaInput {
    rmaNumber: String!
    customerId: String!
    locationId: ID!
    items: [RmaItemInput!]!
  }

  input RmaItemInput {
    variantId: ID!
    quantity: Int!
    unitCostCents: Int!
  }

  input ReceiveRmaInput {
    rmaId: ID!
    items: [ReceiveRmaItemInput!]!
    actorId: ID!
  }

  input ReceiveRmaItemInput {
    itemId: ID!
    receivedQuantity: Int!
    disposition: RMADisposition!
    serializedItems: [String!]
    lotNumber: String
  }

  input InventoryCountInput {
    sku: String!
    locationId: String!
    physicalQuantity: Int!
    actorId: ID!
  }

  input InventoryCountResult {
    sku: String!
    locationId: String!
    systemQuantity: Int!
    physicalQuantity: Int!
    adjustmentQuantity: Int!
  }

  input SubmitOpeningBalanceInput {
    sku: String!
    locationId: String!
    quantity: Int!
    unitCostCents: Int!
    lotNumber: String!
    expirationDate: String!
    actorId: ID!
  }

  input SellKitInput {
    kitId: ID!
    locationId: String!
    quantity: Int!
    actorId: ID!
  }

  input AssembleKitInput {
    kitId: ID!
    locationId: String!
    quantity: Int!
    actorId: ID!
  }

  input DisassembleKitInput {
    kitId: ID!
    locationId: String!
    quantity: Int!
    actorId: ID!
  }

  input ReceiveSerializedInput {
    serialNumber: String!
    sku: String!
    locationId: ID!
    actorId: ID!
  }

  input SellSerializedInput {
    serialNumber: String!
    tenantId: ID!
    saleId: String!
    actorId: ID!
  }

  input ReturnSerializedInput {
    serialNumber: String!
    tenantId: ID!
    referenceId: String!
    actorId: ID!
  }

  input RestockSerializedInput {
    serialNumber: String!
    tenantId: ID!
    locationId: ID!
    referenceId: String!
    actorId: ID!
  }

  input WriteOffSerializedInput {
    serialNumber: String!
    variantId: ID!
    tenantId: ID!
    reason: String!
    actorId: ID!
  }

  input ConnectShopifyInput {
    shopName: String!
    accessToken: String!
  }

  input CreateStockOnboardingInput {
    description: String!
    actorId: ID!
  }

  input OnboardingItemInput {
    sku: String!
    locationId: String!
    departmentName: String!
    initialQuantity: Int!
  }

  input SaveStockOnboardingItemsInput {
    onboardingId: ID!
    items: [OnboardingItemInput!]!
  }

  input CreateWarehouseLocationInput {
    id: ID!
    warehouseId: String!
    zone: String!
    aisle: String!
    rack: String!
    shelf: String!
    bin: String!
    maxWeightGrams: Int!
    maxVolumeCubicMeters: Float!
    gridX: Int
    gridY: Int
    width: Int
    height: Int
  }

  input CreateStockTransferInput {
    sku: String!
    sourceLocationId: String!
    destinationLocationId: String!
    quantity: Int!
    actorId: ID!
  }

  input CreateReplenishmentRuleInput {
    sku: String!
    locationId: String!
    reorderPoint: Int!
    reorderQuantity: Int!
    safetyStock: Int!
  }

  input PurchaseOrderItemInput {
    variantId: ID!
    quantity: Int!
    unitCostCents: Int!
  }

  input CreatePurchaseOrderInput {
    purchaseOrderNumber: String!
    vendorId: String!
    locationId: ID!
    items: [PurchaseOrderItemInput!]!
  }

  type Query {
    inventoryItems: [InventoryItem!]!
    inventoryItem(sku: String!, locationId: String): InventoryItem
    ledgerEntries: [LedgerEntry!]!
    warehouseLocations: [WarehouseLocation!]!
    replenishmentRules: [ReplenishmentRule!]!
    demandForecasts(sku: String!, locationId: String!): [DemandForecast!]!
    serializedItems: [SerializedItem!]!
    quarantineItems: [QuarantineItem!]!
    rmas: [Rma!]!
    rma(id: ID!): Rma
    outboxEvents: [OutboxEvent!]!
    outboxStats: OutboxStats!
    purchaseOrders: [PurchaseOrder!]!
    purchaseOrder(id: ID!): PurchaseOrder
    auditDiscrepancies: [AuditDiscrepancy!]!
    complianceLedger(sequenceNumber: Int): [ComplianceLedgerEntry!]!
    verifyComplianceLedger: Boolean!
    slottingSuggestions: [SlottingSuggestion!]!
    rfidTags(tenantId: ID!): [RfidTag!]!

    # Onboarding & users & logic
    users(tenantId: ID!): [UserDTO!]!
    stockOnboarding(id: ID!): String!
    evaluateReplenishment(tenantId: ID!): Boolean!
    getCarrierRates(weightGrams: Int!, destinationAddress: String!): [CarrierRate!]!
    optimizeFulfillment(sku: String!, quantity: Int!, destinationAddress: String!): FulfillmentPlan!
    shipments: [Shipment!]!
    getStockVelocity(sku: String!, locationId: String, bucketSize: String): [StockVelocityBucket!]!
  }

  type Mutation {
    assignRfidTag(epc: String!, sku: String!, serialNumber: String!): Boolean!
    simulateRfidScan(locationId: String!, tags: [String!]!): Boolean!

    createRma(input: CreateRmaInput!): Rma!
    authorizeRma(id: ID!): Boolean!
    receiveRma(input: ReceiveRmaInput!): Boolean!
    resolveQuarantineItem(id: ID!, resolution: String!): Boolean!

    receiveStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    dispatchStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    allocateStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    releaseAllocation(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    fulfillAllocation(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    createInTransit(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    receiveInTransit(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    submitInventoryCount(counts: [InventoryCountInput!]!): [InventoryCountResult!]!
    submitOpeningBalance(input: SubmitOpeningBalanceInput!): Boolean!

    sellKit(input: SellKitInput!): Boolean!
    assembleKit(input: AssembleKitInput!): Boolean!
    disassembleKit(input: DisassembleKitInput!): Boolean!

    receiveSerializedItem(input: ReceiveSerializedInput!): Boolean!
    sellSerializedItem(input: SellSerializedInput!): Boolean!
    returnSerializedItem(input: ReturnSerializedInput!): Boolean!
    restockSerializedItem(input: RestockSerializedInput!): Boolean!
    writeOffSerializedItem(input: WriteOffSerializedInput!): Boolean!
    connectShopifyStore(input: ConnectShopifyInput!): Boolean!

    login(tenantId: ID!, actorId: ID, role: String, email: String, password: String): String!
    setup(orgName: String!, tenantId: ID!, adminName: String!, adminEmail: String!, adminPassword: String!): Boolean!
    inviteUser(tenantId: ID!, email: String!, role: String!): UserInvitationResult!
    updateUserRole(tenantId: ID!, userId: ID!, role: String!): Boolean!
    createWarehouseLocation(input: CreateWarehouseLocationInput!): WarehouseLocation!
    deleteWarehouseLocation(id: ID!): Boolean!

    createStockTransfer(input: CreateStockTransferInput!): StockTransfer!
    dispatchStockTransfer(id: ID!, actorId: ID!, tenantId: ID!): StockTransfer!
    receiveStockTransfer(id: ID!, actorId: ID!, tenantId: ID!): StockTransfer!
    cancelStockTransfer(id: ID!, actorId: ID!, tenantId: ID!): StockTransfer!

    createReplenishmentRule(input: CreateReplenishmentRuleInput!): ReplenishmentRule!
    toggleReplenishmentRule(id: ID!, isActive: Boolean!): ReplenishmentRule!

    createPurchaseOrder(input: CreatePurchaseOrderInput!): PurchaseOrder!
    placePurchaseOrder(id: ID!): PurchaseOrder!
    receivePurchaseOrder(id: ID!, actorId: ID!, tenantId: ID!): PurchaseOrder!
    cancelPurchaseOrder(id: ID!): PurchaseOrder!

    receiveStockWithLot(sku: String!, locationId: String!, quantity: Int!, unitCostCents: Int!, lotNumber: String!, expirationDate: String!): Boolean!
    markNotificationAsRead(id: ID!): Boolean!
    markAllNotificationsAsRead(tenantId: ID!): Boolean!

    retryOutboxEvent(id: ID!): Boolean!

    createWebhookSubscription(targetUrl: String!, secret: String!, eventTypes: [String!]!): WebhookSubscription!
    updateWebhookSubscription(id: ID!, targetUrl: String, secret: String, eventTypes: [String!], isActive: Boolean): WebhookSubscription!
    deleteWebhookSubscription(id: ID!): Boolean!

    runAudit(tenantId: ID!): AuditSummary!
    resolveAuditDiscrepancy(id: ID!, notes: String!): Boolean!
    createStockOnboarding(input: CreateStockOnboardingInput!): Boolean!
    saveStockOnboardingItems(input: SaveStockOnboardingItemsInput!): Boolean!
    submitStockOnboarding(id: ID!, actorId: ID!): Boolean!
  }

  type Subscription {
    rfidScanStream(tenantId: ID!): RfidScanUpdate!
  }

  type RfidTag {
    epc: String!
    sku: String!
    serialNumber: String!
    status: String!
    lastSeenAt: String
    lastLocation: String
  }

  type RfidScanUpdate {
    id: ID!
    tenantId: String!
    locationId: String!
    totalCount: Int!
    matchedCount: Int!
    unmatchedCount: Int!
    unmatchedEpcs: [String!]!
  }
`);

const inventoryResolvers = {
  ...resolvers,
  WarehouseLocation: {
    __resolveReference(reference: any, context: any) {
      return context.prisma.warehouseLocationModel.findUnique({
  Query: {
    ...resolvers.Query,
    slottingSuggestions: async (_: any, __: any, context: any) => {
      // 1. Fetch locations
      const locations = await context.prisma.warehouseLocation.findMany();
      if (locations.length === 0) return [];

      // 2. Fetch inventory
      const inventory = await context.prisma.inventoryItem.findMany();
      if (inventory.length === 0) return [];

      // 3. Fetch dispatches
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dispatchesRaw = await context.prisma.ledgerEntry.findMany({
        where: {
          quantity: { lt: 0 },
          occurredAt: { gte: thirtyDaysAgo }
        },
        include: {
          variant: true
        }
      });

      const dispatches = dispatchesRaw.map((d: any) => ({
        sku: d.variant.sku,
        location_id: d.locationId,
        quantity: d.quantity,
        date: d.occurredAt.toISOString()
      }));

      // Map data to matching names/aliases for FastAPI
      const sidecarLocations = locations.map((l: any) => ({
        id: l.id,
        grid_x: l.gridX,
        grid_y: l.gridY
      }));

      const sidecarInventory = inventory.map((i: any) => ({
        sku: i.sku,
        location_id: i.locationId
      }));

      // Call Python sidecar, fallback to basic heuristic if offline
      try {
        const response = await fetch(PYTHON_SIDECAR_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locations: sidecarLocations,
            inventory: sidecarInventory,
            dispatches
          })
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (err: any) {
        console.warn(`[Inventory Subgraph] Python sidecar down. Fallback to basic: ${err.message}`);
      }

      // Simple fallback sorting heuristic to keep tests passing offline
      const locDistanceMap = new Map<string, number>();
      for (const loc of locations) {
        locDistanceMap.set(loc.id, Math.abs(loc.gridX) + Math.abs(loc.gridY));
      }

      const velocities = new Map<string, number>();
      for (const d of dispatches) {
        const key = `${d.sku}_${d.location_id}`;
        velocities.set(key, (velocities.get(key) || 0) + Math.abs(d.quantity));
      }

      const itemRecords = inventory.map((item: any) => {
        const key = `${item.sku}_${item.locationId}`;
        const velocity = velocities.get(key) || 0;
        const distance = locDistanceMap.get(item.locationId) ?? 9999;
        return {
          sku: item.sku,
          locationId: item.locationId,
          velocity,
          distance
        };
      });

      itemRecords.sort((a: any, b: any) => b.velocity - a.velocity);
      const suggestions: any[] = [];
      const matchedLocations = new Set<string>();

      for (const item of itemRecords) {
        if (item.velocity === 0) continue;
        if (matchedLocations.has(item.locationId)) continue;

        let bestSwapTarget: any = null;
        let maxDistanceDiff = 0;

        for (const target of itemRecords) {
          if (target.locationId === item.locationId) continue;
          if (matchedLocations.has(target.locationId)) continue;

          if (target.distance < item.distance && target.velocity < item.velocity) {
            const distanceDiff = item.distance - target.distance;
            if (distanceDiff > maxDistanceDiff) {
              maxDistanceDiff = distanceDiff;
              bestSwapTarget = target;
            }
          }
        }

        if (bestSwapTarget) {
          suggestions.push({
            sku: item.sku,
            currentLocationId: item.locationId,
            currentDistance: item.distance,
            currentVelocity: item.velocity,
            recommendedLocationId: bestSwapTarget.locationId,
            recommendedDistance: bestSwapTarget.distance,
            potentialSwapSku: bestSwapTarget.sku,
            estimatedSavings: item.velocity * maxDistanceDiff * 2
          });
          matchedLocations.add(item.locationId);
          matchedLocations.add(bestSwapTarget.locationId);
        }
      }

      return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
    }
  },
  WarehouseLocation: {
    __resolveReference(reference: any, context: any) {
      return context.prisma.warehouseLocation.findUnique({
        where: { id: reference.id }
      });
    }
  }
};

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers: inventoryResolvers as any }),
});

async function start() {
  const PORT = parseInt(process.env.PORT || '4001', 10);
  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || req.headers.Authorization || '';
      let auth: any = undefined;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          auth = jwt.verify(token, JWT_SECRET) as any;
        } catch (err) {}
      }
      const tenantId = auth?.tenantId;
      const activePrisma = tenantId ? getTenantPrisma(globalPrisma, tenantId) : globalPrisma;
      return {
        auth,
        prisma: activePrisma,
        loaders: createDataLoaders(activePrisma),
      };
    },
  });
  console.log(`🚀 Inventory Subgraph ready at ${url}`);
}

start().catch(console.error);
