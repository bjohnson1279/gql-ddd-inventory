export const typeDefs = `#graphql
  enum TrackingMode {
    quantity
    serial
    lot
  }

  enum UomCategory {
    discrete
    weight
    volume
  }

  enum AccountingMethod {
    cash
    accrual
  }

  enum DebitCredit {
    debit
    credit
  }

  enum StockOnboardingStatus {
    draft
    submitted
  }

  enum BarcodeSymbology {
    upc_a
    upc_e
    ean_13
    ean_8
    code_128
    qr
    itf_14
    gs1_128
  }

  enum BarcodeSource {
    supplier
    internal
    gs1
  }

  enum ScanContext {
    pos
    receiving
    cycle_count
    transfer_out
    transfer_in
  }

  type VariantAttribute {
    name: String!
    value: String!
  }

  input AttributeInput {
    name: String!
    value: String!
  }

  type Lot {
    lotNumber: String!
    expirationDate: String!
  }

  type InventoryCostLayer {
    id: ID!
    variantId: ID!
    initialQuantity: Int!
    consumedQuantity: Int!
    unitCostCents: Int!
    receivedAt: String!
    serialNumber: String
    lot: Lot
  }

  type FefoPickSuggestion {
    locationId: ID!
    lotNumber: String!
    expirationDate: String!
    quantity: Int!
  }

  type ContaminatedDispatch {
    ledgerEntryId: ID!
    locationId: ID!
    quantity: Int!
    referenceId: String
    occurredAt: String!
    actorId: String!
  }

  type ExternalMapping {
    id: ID!
    tenantId: ID!
    integrationId: ID!
    entityType: String!
    internalId: String!
    externalId: String!
    externalSecondaryId: String
  }

  type ProductVariant {
    id: ID!
    sku: String!
    trackingMode: TrackingMode!
    costingMethod: String!
    attributes: [VariantAttribute!]!
    costLayers: [InventoryCostLayer!]!
    externalMappings: [ExternalMapping!]!
  }

  type Product {
    id: ID!
    name: String!
    variants: [ProductVariant!]!
  }

  input KitComponentInput {
    variantId: ID!
    quantity: Int!
  }

  type KitComponent {
    variantId: ID!
    quantity: Int!
  }

  type Kit {
    id: ID!
    sku: String!
    name: String!
    components: [KitComponent!]!
  }

  type StatusTransition {
    from: String!
    to: String!
    reason: String!
    actor: String!
    occurredAt: String!
    referenceId: String
  }

  type SerializedItem {
    id: ID!
    variantId: ID!
    serialNumber: String!
    tenantId: ID!
    locationId: ID!
    status: String!
    history: [StatusTransition!]!
  }

  type ShopifyConnection {
    id: ID!
    tenantId: ID!
    platform: String!
    storeDomain: String!
    isActive: Boolean!
  }

  type InventoryItem {
    id: ID!
    sku: String!
    locationId: String!
    quantity: Int!
    allocated: Int!
    inTransit: Int!
    available: Int!
    version: Int!
  }

  type UnitOfMeasure {
    name: String!
    abbreviation: String!
    category: UomCategory!
  }

  input UnitInput {
    name: String!
    abbreviation: String!
    category: UomCategory!
  }

  type ConversionRule {
    id: ID!
    unit: UnitOfMeasure!
    factorToBase: Float!
    label: String
  }

  input ConversionRuleInput {
    unit: UnitInput!
    factorToBase: Float!
    label: String
  }

  type ProductUomConfiguration {
    sku: String!
    baseUnit: UnitOfMeasure!
    purchaseUnit: UnitOfMeasure!
    saleUnit: UnitOfMeasure!
    conversionRules: [ConversionRule!]!
  }

  type JournalLine {
    accountCode: String!
    amountCents: Int!
    type: DebitCredit!
    memo: String
  }

  input JournalLineInput {
    accountCode: String!
    amountCents: Int!
    type: DebitCredit!
    memo: String
  }

  type JournalEntry {
    id: ID!
    tenantId: ID!
    date: String!
    description: String!
    method: AccountingMethod!
    referenceId: String
    lines: [JournalLine!]!
  }

  type Barcode {
    value: String!
    symbology: BarcodeSymbology!
  }

  type BarcodeAssignment {
    id: ID!
    sku: String!
    barcode: Barcode!
    source: BarcodeSource!
    isPrimary: Boolean!
    assignedAt: String!
  }

  type VariantBarcodeSet {
    sku: String!
    assignments: [BarcodeAssignment!]!
  }

  input AssignBarcodeInput {
    sku: String!
    barcodeValue: String!
    symbology: BarcodeSymbology!
    source: BarcodeSource!
    makePrimary: Boolean
  }

  input RevokeBarcodeInput {
    sku: String!
    assignmentId: ID!
  }

  input ScanPayloadInput {
    locationId: String
    amount: Int
    actualQuantity: Int
  }

  type StockOnboardingItem {
    variantId: ID!
    quantity: Int!
    unitCostCents: Int!
  }

  type StockOnboarding {
    id: ID!
    tenantId: ID!
    locationId: ID!
    status: StockOnboardingStatus!
    asOfDate: String!
    items: [StockOnboardingItem!]!
  }

  input CreateStockOnboardingInput {
    id: ID!
    tenantId: ID!
    locationId: ID!
    asOfDate: String!
  }

  input SaveStockOnboardingItemsInput {
    id: ID!
    items: [OpeningBalanceItemInput!]!
  }

  type WarehouseLocation {
    id: ID!
    warehouseId: String!
    zone: String!
    aisle: String!
    rack: String!
    shelf: String!
    bin: String!
    maxWeightGrams: Int!
    maxVolumeCubicMeters: Float!
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
  }

  enum StockTransferStatus {
    draft
    dispatched
    received
    cancelled
  }

  type StockTransferItem {
    variantId: ID!
    quantity: Int!
  }

  type StockTransfer {
    id: ID!
    tenantId: ID!
    sourceLocationId: String!
    destinationLocationId: String!
    status: StockTransferStatus!
    items: [StockTransferItem!]!
    referenceId: String
    dispatchedAt: String
    receivedAt: String
    createdAt: String!
  }

  input StockTransferItemInput {
    variantId: ID!
    quantity: Int!
  }

  input CreateStockTransferInput {
    tenantId: ID!
    sourceLocationId: String!
    destinationLocationId: String!
    items: [StockTransferItemInput!]!
    referenceId: String
  }

  enum ReplenishmentType {
    SUPPLIER
    TRANSFER
  }

  enum PurchaseOrderStatus {
    DRAFT
    ORDERED
    RECEIVED
    CANCELLED
  }

  type ReplenishmentRule {
    id: ID!
    tenantId: ID!
    sku: String!
    locationId: String!
    reorderPoint: Int!
    reorderQuantity: Int!
    safetyStock: Int!
    leadTimeDays: Int!
    replenishmentType: ReplenishmentType!
    sourceLocationId: String
    supplierId: String
    isActive: Boolean!
    dynamicRopEnabled: Boolean!
  }

  type PurchaseOrderItem {
    variantId: ID!
    quantity: Int!
  }

  type PurchaseOrder {
    id: ID!
    tenantId: ID!
    supplierId: String!
    destinationLocationId: String!
    status: PurchaseOrderStatus!
    items: [PurchaseOrderItem!]!
    createdAt: String!
    updatedAt: String!
  }

  input CreateReplenishmentRuleInput {
    tenantId: ID!
    sku: String!
    locationId: String!
    reorderPoint: Int!
    reorderQuantity: Int!
    safetyStock: Int!
    leadTimeDays: Int!
    replenishmentType: ReplenishmentType!
    sourceLocationId: String
    supplierId: String
    dynamicRopEnabled: Boolean
  }

  input PurchaseOrderItemInput {
    variantId: ID!
    quantity: Int!
  }

  input CreatePurchaseOrderInput {
    tenantId: ID!
    supplierId: String!
    destinationLocationId: String!
    items: [PurchaseOrderItemInput!]!
  }

  type PutawayRecommendation {
    locationId: ID!
    quantity: Int!
    remainingWeightGrams: Int!
    remainingVolumeCubicMeters: Float!
  }

  type PickRouteItem {
    sku: String!
    locationId: ID!
    quantity: Int!
    warehouseId: String!
    zone: String!
    aisle: String!
    rack: String!
    shelf: String!
    bin: String!
  }

  type PickRoute {
    warehouseId: String!
    items: [PickRouteItem!]!
  }

  input PutawayInput {
    sku: String!
    quantity: Int!
  }

  input PickItemInput {
    sku: String!
    quantity: Int!
    locationId: ID!
  }

  type Query {
    inventoryItems: [InventoryItem!]!
    inventoryItemBySku(sku: String!): [InventoryItem!]!
    inventoryItemBySkuAndLocation(sku: String!, locationId: String!): InventoryItem
    product(id: ID!): Product
    products: [Product!]!
    serializedItemBySerial(serialNumber: String!, tenantId: ID!): SerializedItem
    shopifyConnections(tenantId: ID!): [ShopifyConnection!]!
    
    productUomConfiguration(sku: String!): ProductUomConfiguration
    journalEntries(tenantId: ID!): [JournalEntry!]!
    barcodeSet(sku: String!): VariantBarcodeSet
    lookupBarcode(barcodeValue: String!): String
    stockOnboarding(id: ID!): StockOnboarding
    stockOnboardings(tenantId: ID!): [StockOnboarding!]!
    warehouseLocation(id: ID!): WarehouseLocation
    warehouseLocations: [WarehouseLocation!]!
    historicalStockLevel(sku: String!, locationId: String!, timestamp: String!): Int!
    stockTransfer(id: ID!): StockTransfer
    stockTransfers(tenantId: ID!): [StockTransfer!]!
    replenishmentRules(tenantId: ID!): [ReplenishmentRule!]!
    purchaseOrder(id: ID!): PurchaseOrder
    purchaseOrders(tenantId: ID!): [PurchaseOrder!]!

    suggestPutawayLocations(input: PutawayInput!): [PutawayRecommendation!]!
    optimizePickingRoute(tenantId: ID!, items: [PickItemInput!]!): [PickRoute!]!

    suggestFefoPicking(sku: String!, quantity: Int!): [FefoPickSuggestion!]!
    traceProductRecall(lotNumber: String!): [ContaminatedDispatch!]!
  }

  type InventoryCountResult {
    sku: String!
    locationId: String!
    expected: Int!
    actual: Int!
    variance: Int!
  }

  input InventoryCountInput {
    sku: String!
    locationId: String!
    actualQuantity: Int!
  }

  input OpeningBalanceItemInput {
    variantId: ID!
    quantity: Int!
    unitCostCents: Int!
  }

  input SubmitOpeningBalanceInput {
    tenantId: ID!
    locationId: ID!
    asOfDate: String!
    actorId: ID!
    items: [OpeningBalanceItemInput!]!
  }

  input ConnectShopifyInput {
    id: ID!
    tenantId: ID!
    storeDomain: String!
    accessToken: String!
  }

  input SellKitInput {
    tenantId: ID!
    locationId: ID!
    kitId: ID!
    sku: String!
    name: String!
    quantity: Int!
    referenceId: String!
    actorId: ID!
    components: [KitComponentInput!]!
  }

  input AssembleKitInput {
    tenantId: ID!
    locationId: String!
    kitSku: String!
    quantity: Int!
    actorId: ID!
    referenceId: String!
  }

  input DisassembleKitInput {
    tenantId: ID!
    locationId: String!
    kitSku: String!
    quantity: Int!
    actorId: ID!
    referenceId: String!
  }

  input ReceiveSerializedInput {
    variantId: ID!
    serialNumber: String!
    tenantId: ID!
    locationId: ID!
    actorId: ID!
    purchaseOrderId: String!
    unitCostCents: Int!
  }

  input ConfigureUomInput {
    sku: String!
    baseUnit: UnitInput!
    purchaseUnit: UnitInput
    saleUnit: UnitInput
    conversionRules: [ConversionRuleInput!]!
  }

  input CreateJournalEntryInput {
    id: ID!
    tenantId: ID!
    date: String!
    description: String!
    method: AccountingMethod!
    referenceId: String
    lines: [JournalLineInput!]!
  }

  type Mutation {
    receiveStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    dispatchStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    allocateStock(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    releaseAllocation(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    fulfillAllocation(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    createInTransit(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    receiveInTransit(sku: String!, locationId: String!, amount: Int!): InventoryItem!
    submitInventoryCount(counts: [InventoryCountInput!]!): [InventoryCountResult!]!
    submitOpeningBalance(input: SubmitOpeningBalanceInput!): Boolean!
    
    createProduct(id: ID!, name: String!): Boolean!
    addProductVariant(productId: ID!, sku: String!, attributes: [AttributeInput!]!, trackingMode: TrackingMode!): Boolean!
    createKit(id: ID!, sku: String!, name: String!, components: [KitComponentInput!]!): Boolean!
    sellKit(input: SellKitInput!): Boolean!
    assembleKit(input: AssembleKitInput!): Boolean!
    disassembleKit(input: DisassembleKitInput!): Boolean!
    
    receiveSerializedItem(input: ReceiveSerializedInput!): Boolean!
    connectShopifyStore(input: ConnectShopifyInput!): Boolean!
    
    configureProductUom(input: ConfigureUomInput!): Boolean!
    createJournalEntry(input: CreateJournalEntryInput!): Boolean!
    assignBarcode(input: AssignBarcodeInput!): Boolean!
    revokeBarcode(input: RevokeBarcodeInput!): Boolean!
    generateInternalBarcode(sku: String!, tenantId: ID!): String!
    dispatchBarcodeScan(rawScan: String!, context: ScanContext!, payload: ScanPayloadInput!): Boolean!
    createStockOnboarding(input: CreateStockOnboardingInput!): Boolean!
    saveStockOnboardingItems(input: SaveStockOnboardingItemsInput!): Boolean!
    submitStockOnboarding(id: ID!, actorId: ID!): Boolean!
    login(tenantId: ID!, actorId: ID!, role: String, password: String): String!
    createWarehouseLocation(input: CreateWarehouseLocationInput!): WarehouseLocation!
    deleteWarehouseLocation(id: ID!): Boolean!

    createStockTransfer(input: CreateStockTransferInput!): StockTransfer!
    dispatchStockTransfer(id: ID!, actorId: ID!, tenantId: ID!): StockTransfer!
    receiveStockTransfer(id: ID!, actorId: ID!, tenantId: ID!): StockTransfer!
    cancelStockTransfer(id: ID!, actorId: ID!, tenantId: ID!): StockTransfer!

    createReplenishmentRule(input: CreateReplenishmentRuleInput!): ReplenishmentRule!
    toggleReplenishmentRule(id: ID!, isActive: Boolean!): ReplenishmentRule!
    evaluateReplenishment(tenantId: ID!): Boolean!

    createPurchaseOrder(input: CreatePurchaseOrderInput!): PurchaseOrder!
    placePurchaseOrder(id: ID!): PurchaseOrder!
    receivePurchaseOrder(id: ID!, actorId: ID!, tenantId: ID!): PurchaseOrder!
    cancelPurchaseOrder(id: ID!): PurchaseOrder!

    updateProductVariantCostingMethod(sku: String!, costingMethod: String!): ProductVariant!
    receiveStockWithLot(sku: String!, locationId: String!, quantity: Int!, unitCostCents: Int!, lotNumber: String!, expirationDate: String!): Boolean!
  }

  type Subscription {
    barcodeScanned(tenantId: ID!): BarcodeScanEvent!
  }

  type BarcodeScanEvent {
    scanValue: String!
    symbology: String!
    context: String!
    status: String!
    time: String!
    payload: String!
  }
`;


