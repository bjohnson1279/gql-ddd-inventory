jest.mock('../../../src/infrastructure/persistence/PostgresInventoryRepository', () => {
  const { InMemoryInventoryRepository } = require('../../../src/infrastructure/persistence/InMemoryInventoryRepository');
  return { PostgresInventoryRepository: InMemoryInventoryRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresProductRepository', () => {
  const { InMemoryProductRepository } = require('../../../src/infrastructure/persistence/InMemoryProductRepository');
  return { PostgresProductRepository: InMemoryProductRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresLedgerRepository', () => {
  const { InMemoryLedgerRepository } = require('../../../src/infrastructure/persistence/InMemoryLedgerRepository');
  return { PostgresLedgerRepository: InMemoryLedgerRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresSerializedItemRepository', () => {
  const { InMemorySerializedItemRepository } = require('../../../src/infrastructure/persistence/InMemorySerializedItemRepository');
  return { PostgresSerializedItemRepository: InMemorySerializedItemRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresInventoryCostLayerRepository', () => {
  return { PostgresInventoryCostLayerRepository: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    getActiveLayers: jest.fn().mockResolvedValue([]),
    findBySerial: jest.fn().mockResolvedValue(null)
  })) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresIntegrationRepository', () => {
  return { PostgresIntegrationRepository: jest.fn().mockImplementation(() => {
    const map = new Map();
    return {
      save: jest.fn(async (conn) => { map.set(conn.id.value, conn); }),
      findById: jest.fn(async (id) => map.get(id.value) || null),
      findAllByTenant: jest.fn(async (tenantId) => Array.from(map.values()).filter((c: any) => c.tenantId.equals(tenantId)))
    };
  }) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresExternalMappingRepository', () => {
  return { PostgresExternalMappingRepository: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    findByInternalId: jest.fn().mockResolvedValue(null),
    findByExternalId: jest.fn().mockResolvedValue(null),
    delete: jest.fn()
  })) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresProductUomConfigurationRepository', () => {
  return { PostgresProductUomConfigurationRepository: jest.fn().mockImplementation(() => {
    const map = new Map();
    return {
      save: jest.fn(async (config) => { map.set(config.sku.value, config); }),
      findBySku: jest.fn(async (sku) => map.get(sku.value) || null)
    };
  }) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresJournalRepository', () => {
  return { PostgresJournalRepository: jest.fn().mockImplementation(() => {
    const map = new Map();
    return {
      save: jest.fn(async (entry) => { map.set(entry.id.value, entry); }),
      findById: jest.fn(async (id) => map.get(id.value) || null),
      findAllByTenant: jest.fn(async (tenantId) => Array.from(map.values()).filter((e: any) => e.tenantId.equals(tenantId)))
    };
  }) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresBarcodeRepository', () => {
  return { PostgresBarcodeRepository: jest.fn().mockImplementation(() => {
    const { VariantBarcodeSet } = require('../../../src/domain/entities/VariantBarcodeSet');
    const map = new Map();
    return {
      save: jest.fn(async (set) => { map.set(set.sku.value, set); }),
      findSetBySku: jest.fn(async (sku) => {
        if (!sku.value.startsWith('SKU')) return null;
        if (!map.has(sku.value)) {
          map.set(sku.value, new VariantBarcodeSet(sku));
        }
        return map.get(sku.value);
      }),
      findSkuByBarcodeValue: jest.fn(async (value) => {
        for (const set of map.values()) {
          for (const a of set.all) {
            if (a.barcode.value === value) {
              return set.sku;
            }
          }
        }
        return null;
      })
    };
  }) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresStockOnboardingRepository', () => {
  return { PostgresStockOnboardingRepository: jest.fn().mockImplementation(() => {
    const { StockOnboarding } = require('../../../src/domain/entities/StockOnboarding');
    const map = new Map();
    return {
      save: jest.fn(async (onboarding) => { map.set(onboarding.id.value, onboarding); }),
      findById: jest.fn(async (id) => map.get(id.value) || null),
      findAllByTenant: jest.fn(async (tenantId) => Array.from(map.values()).filter((o: any) => o.tenantId.equals(tenantId)))
    };
  }) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresWarehouseLocationRepository', () => {
  const { InMemoryWarehouseLocationRepository } = require('../../../src/infrastructure/persistence/InMemoryWarehouseLocationRepository');
  return { PostgresWarehouseLocationRepository: InMemoryWarehouseLocationRepository };
});

import { setTimeout } from 'timers';
import { resolvers, prisma, pool } from '../../../src/infrastructure/graphql/resolvers';

// Mock the Prisma/Pool calls to prevent database connection attempts during test lifecycle
jest.spyOn(prisma.inventoryItem, 'deleteMany').mockImplementation(() => Promise.resolve({ count: 0 }) as any);
jest.spyOn(prisma, '$disconnect').mockImplementation(() => Promise.resolve());
jest.spyOn(pool, 'end').mockImplementation(() => Promise.resolve());

describe('GraphQL Resolvers', () => {
  beforeAll(async () => {
    // Clear the DB using the resolvers' Prisma client
    await prisma.inventoryItem.deleteMany({});
  }, 30000);

  afterAll(async () => {
    // Wait for any pending event bus tasks to complete before tearing down
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.$disconnect();
    await pool.end();
  });
  it('should receive stock through mutation', async () => {
    const result = await (resolvers.Mutation as any).receiveStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: 10 });
    
    expect(result.sku).toBe('SKU1');
    expect(result.quantity).toBe(10);
  });

  it('should query inventory items', async () => {
    // We just added SKU1 in the previous test
    const result = await (resolvers.Query as any).inventoryItems();
    
    expect(result.length).toBeGreaterThan(0);
    expect(result.find((item: any) => item.sku === 'SKU1')).toBeDefined();
  });

  it('should dispatch stock through mutation', async () => {
    const result = await (resolvers.Mutation as any).dispatchStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: 5 });
    
    expect(result.quantity).toBe(5);
  });

  it('should query inventory item by SKU', async () => {
    const result = await (resolvers.Query as any).inventoryItemBySku(null, { sku: 'SKU1' });
    
    expect(result[0].sku).toBe('SKU1');
    expect(result[0].quantity).toBe(5);
  });

  it('should query inventory item by SKU (null case)', async () => {
    const result = await (resolvers.Query as any).inventoryItemBySku(null, { sku: 'NON-EXISTENT' });
    expect(result).toEqual([]);
  });

  it('should handle errors in mutations (dispatchStock)', async () => {
    // Attempt to dispatch more than available
    await expect((resolvers.Mutation as any).dispatchStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: 100 }))
      .rejects.toThrow();
  });

  it('should handle errors in mutations (receiveStock)', async () => {
    // Attempt to receive negative amount
    await expect((resolvers.Mutation as any).receiveStock(null, { sku: 'SKU1', locationId: 'LOC1', amount: -10 }))
      .rejects.toThrow();
  });

  it('should submit inventory count', async () => {
    const counts = [
      { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 20 },
      { sku: 'SKU2', locationId: 'LOC2', actualQuantity: 15 },
    ];
    const result = await (resolvers.Mutation as any).submitInventoryCount(null, { counts });
    
    expect(result).toHaveLength(2);
    expect(result[0].sku).toBe('SKU1');
    expect(result[0].actual).toBe(20);
    expect(result[1].sku).toBe('SKU2');
    expect(result[1].actual).toBe(15);
  });

  it('should handle errors in mutations (submitInventoryCount)', async () => {
    // Attempt to submit negative actual quantity
    const counts = [{ sku: 'SKU1', locationId: 'LOC1', actualQuantity: -5 }];
    await expect((resolvers.Mutation as any).submitInventoryCount(null, { counts }))
      .rejects.toThrow();
  });

  it('should submit opening balance', async () => {
    const input = {
      tenantId: 'T1',
      locationId: 'L1',
      asOfDate: '2024-01-01',
      actorId: 'A1',
      items: [
        { variantId: 'V1', quantity: 10, unitCostCents: 1000 }
      ]
    };
    const result = await (resolvers.Mutation as any).submitOpeningBalance(null, { input });
    expect(result).toBe(true);
  });

  it('should create product, variants, and query them', async () => {
    const createResult = await (resolvers.Mutation as any).createProduct(null, { id: 'p-123', name: 'Test Product' });
    expect(createResult).toBe(true);

    const variantResult = await (resolvers.Mutation as any).addProductVariant(null, {
      productId: 'p-123',
      sku: 'SKU-V1',
      attributes: [{ name: 'size', value: 'M' }],
      trackingMode: 'quantity'
    });
    expect(variantResult).toBe(true);

    const products = await (resolvers.Query as any).products();
    expect(products.length).toBeGreaterThan(0);
    const prod = products.find((p: any) => p.id === 'p-123');
    expect(prod).toBeDefined();
    expect(prod.name).toBe('Test Product');
    expect(prod.variants[0].sku).toBe('SKU-V1');
  });

  it('should connect Shopify store and retrieve it', async () => {
    const connectResult = await (resolvers.Mutation as any).connectShopifyStore(null, {
      input: {
        id: 'conn-123',
        tenantId: 't-shopify',
        storeDomain: 'mystore.myshopify.com',
        accessToken: 'token123'
      }
    });
    expect(connectResult).toBe(true);

    const connections = await (resolvers.Query as any).shopifyConnections(null, { tenantId: 't-shopify' });
    expect(connections).toHaveLength(1);
    expect(connections[0].storeDomain).toBe('mystore.myshopify.com');
  });

  it('should configure Product UOM and retrieve it', async () => {
    const configResult = await (resolvers.Mutation as any).configureProductUom(null, {
      input: {
        sku: 'SKU-UOM',
        baseUnit: { name: 'Each', abbreviation: 'ea', category: 'discrete' },
        purchaseUnit: { name: 'Dozen', abbreviation: 'dz', category: 'discrete' },
        saleUnit: { name: 'Each', abbreviation: 'ea', category: 'discrete' },
        conversionRules: [
          {
            unit: { name: 'Dozen', abbreviation: 'dz', category: 'discrete' },
            factorToBase: 12.0,
            label: 'Dozen rule'
          }
        ]
      }
    });
    expect(configResult).toBe(true);

    const config = await (resolvers.Query as any).productUomConfiguration(null, { sku: 'SKU-UOM' });
    expect(config).not.toBeNull();
    expect(config.sku).toBe('SKU-UOM');
    expect(config.baseUnit.name).toBe('Each');
    expect(config.conversionRules).toHaveLength(1);
    expect(config.conversionRules[0].factorToBase).toBe(12.0);
  });

  it('should create Journal Entry and query them', async () => {
    const journalResult = await (resolvers.Mutation as any).createJournalEntry(null, {
      input: {
        id: 'j-entry-1',
        tenantId: 't-journal',
        date: '2026-05-30T00:00:00Z',
        description: 'Test entry',
        method: 'accrual',
        lines: [
          { accountCode: '1000', amountCents: 5000, type: 'debit', memo: 'Dr side' },
          { accountCode: '2000', amountCents: 5000, type: 'credit', memo: 'Cr side' }
        ]
      }
    });
    expect(journalResult).toBe(true);

    const entries = await (resolvers.Query as any).journalEntries(null, { tenantId: 't-journal' });
    expect(entries).toHaveLength(1);
    expect(entries[0].description).toBe('Test entry');
    expect(entries[0].lines).toHaveLength(2);
    expect(entries[0].lines[0].accountCode).toBe('1000');
  });

  it('should assign, query, revoke, generate, and dispatch scans for barcodes', async () => {
    // 1. Assign barcode
    const assignResult = await (resolvers.Mutation as any).assignBarcode(null, {
      input: {
        sku: 'SKU-BAR',
        barcodeValue: '012345678905',
        symbology: 'upc_a',
        source: 'supplier',
        makePrimary: true
      }
    });
    expect(assignResult).toBe(true);

    // 2. Query barcode set
    const set = await (resolvers.Query as any).barcodeSet(null, { sku: 'SKU-BAR' });
    expect(set).not.toBeNull();
    expect(set.sku).toBe('SKU-BAR');
    expect(set.assignments).toHaveLength(1);
    expect(set.assignments[0].barcode.value).toBe('012345678905');
    const assignmentId = set.assignments[0].id;

    // 3. Lookup barcode
    const sku = await (resolvers.Query as any).lookupBarcode(null, { barcodeValue: '012345678905' });
    expect(sku).toBe('SKU-BAR');

    // 4. Generate internal barcode
    const generated = await (resolvers.Mutation as any).generateInternalBarcode(null, {
      sku: 'SKU-BAR',
      tenantId: 'tenant-123'
    });
    expect(generated).toContain('INV-');

    // 5. Dispatch scan (Receiving)
    const dispatchResult = await (resolvers.Mutation as any).dispatchBarcodeScan(null, {
      rawScan: '012345678905',
      context: 'receiving',
      payload: {
        locationId: 'LOC-WH',
        amount: 20
      }
    });
    expect(dispatchResult).toBe(true);

    // Verify stock was incremented to 20
    const stock = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, {
      sku: 'SKU-BAR',
      locationId: 'LOC-WH'
    });
    expect(stock).not.toBeNull();
    expect(stock.quantity).toBe(20);

    // 6. Revoke barcode
    const setAfterGen = await (resolvers.Query as any).barcodeSet(null, { sku: 'SKU-BAR' });
    const generatedAssignment = setAfterGen.assignments.find((a: any) => a.barcode.value === generated);
    expect(generatedAssignment).toBeDefined();

    // Revoke the generated barcode first (non-primary, set size is 2, allowed)
    const revokeGenResult = await (resolvers.Mutation as any).revokeBarcode(null, {
      input: {
        sku: 'SKU-BAR',
        assignmentId: generatedAssignment.id
      }
    });
    expect(revokeGenResult).toBe(true);

    // Revoke the primary barcode (primary, set size is 1, allowed)
    const revokePrimaryResult = await (resolvers.Mutation as any).revokeBarcode(null, {
      input: {
        sku: 'SKU-BAR',
        assignmentId: assignmentId
      }
    });
    expect(revokePrimaryResult).toBe(true);

    // The set should now be empty
    const finalSet = await (resolvers.Query as any).barcodeSet(null, { sku: 'SKU-BAR' });
    expect(finalSet.assignments).toHaveLength(0);
  });

  it('should support StockOnboarding draft, add items, query, and submit workflows', async () => {
    // 1. Create a draft onboarding sheet
    const createResult = await (resolvers.Mutation as any).createStockOnboarding(null, {
      input: {
        tenantId: 'tenant-onb',
        locationId: 'LOC-ONB',
      }
    });
    expect(typeof createResult).toBe('string');
    const onboardingId = createResult;

    // 2. Save items onto the draft
    const saveResult = await (resolvers.Mutation as any).saveStockOnboardingItems(null, {
      input: {
        id: onboardingId,
        items: [
          { variantId: 'var-1', quantity: 50, unitCostCents: 500 },
          { variantId: 'var-2', quantity: 30, unitCostCents: 1200 }
        ]
      }
    });
    expect(saveResult).toBe(true);

    // 3. Query the onboarding sheet
    const onboarding = await (resolvers.Query as any).stockOnboarding(null, { id: onboardingId }, { auth: { role: 'admin', tenantId: 'tenant-onb' } });
    expect(onboarding).not.toBeNull();
    expect(onboarding.status).toBe('draft');
    expect(onboarding.items).toHaveLength(2);
    expect(onboarding.items.find((i: any) => i.variantId === 'var-1')?.quantity).toBe(50);

    // 4. Query onboarding sheets by tenant
    const tenantOnboardings = await (resolvers.Query as any).stockOnboardings(null, { tenantId: 'tenant-onb' }, { auth: { role: 'admin', tenantId: 'tenant-onb' } });
    expect(tenantOnboardings.length).toBeGreaterThanOrEqual(1);
    expect(tenantOnboardings.some((t: any) => t.id === onboardingId)).toBe(true);

    // 5. Submit the onboarding sheet to the ledger
    const submitResult = await (resolvers.Mutation as any).submitStockOnboarding(null, {
      id: onboardingId,
      actorId: 'actor-onb'
    }, { auth: { role: 'admin', tenantId: 'tenant-onb' } });
    expect(submitResult).toBe(true);

    // Verify it is submitted now
    const submittedOnboarding = await (resolvers.Query as any).stockOnboarding(null, { id: onboardingId }, { auth: { role: 'admin', tenantId: 'tenant-onb' } });
    expect(submittedOnboarding.status).toBe('submitted');
  });

  it('should enforce role-based access control (RBAC) in resolvers', async () => {
    // 1. Authenticate with a viewer role using context
    const mockViewerContext = {
      auth: {
        tenantId: 'tenant-1',
        actorId: 'viewer-user',
        role: 'viewer'
      }
    };

    // 2. Querying catalog items as viewer should succeed
    const products = await (resolvers.Query as any).products(null, {}, mockViewerContext);
    expect(Array.isArray(products)).toBe(true);

    // 3. Performing administrative actions (e.g., createProduct) as a viewer should throw an authorization error
    await expect(
      (resolvers.Mutation as any).createProduct(null, { id: 'prod-fail', name: 'Failed Product' }, mockViewerContext)
    ).rejects.toThrow(/Forbidden: You do not have permission/);

    // 4. Performing accountant actions (e.g., createJournalEntry) as a viewer should throw an authorization error
    await expect(
      (resolvers.Mutation as any).createJournalEntry(null, {
        input: {
          id: 'j-fail',
          tenantId: 'tenant-1',
          date: '2026-05-30',
          description: 'Fail',
          method: 'accrual',
          lines: []
        }
      }, mockViewerContext)
    ).rejects.toThrow(/Forbidden: You do not have permission/);
  });

  it('should manage warehouse locations through queries and mutations', async () => {
    const input = {
      id: 'WH1-ZONEA-A03-R02-S01-B10',
      warehouseId: 'WH1',
      zone: 'ZONEA',
      aisle: 'A03',
      rack: 'R02',
      shelf: 'S01',
      bin: 'B10',
      maxWeightGrams: 50000,
      maxVolumeCubicMeters: 2.5
    };

    // 1. Create a warehouse location
    const created = await (resolvers.Mutation as any).createWarehouseLocation(null, { input });
    expect(created.id).toBe(input.id);
    expect(created.maxWeightGrams).toBe(50000);

    // 2. Query specific warehouse location
    const loc = await (resolvers.Query as any).warehouseLocation(null, { id: input.id });
    expect(loc).not.toBeNull();
    expect(loc.warehouseId).toBe('WH1');

    // 3. Query all warehouse locations
    const list = await (resolvers.Query as any).warehouseLocations(null, {});
    expect(list.length).toBeGreaterThan(0);
    expect(list.find((l: any) => l.id === input.id)).toBeDefined();

    // 4. Delete warehouse location
    const deleted = await (resolvers.Mutation as any).deleteWarehouseLocation(null, { id: input.id });
    expect(deleted).toBe(true);

    // 5. Verify deletion
    const locAfterDelete = await (resolvers.Query as any).warehouseLocation(null, { id: input.id });
    expect(locAfterDelete).toBeNull();
  });

  it('should allocate, release, and fulfill stock commitments through GraphQL mutations', async () => {
    const sku = 'SKU-COMMIT';
    const loc = 'LOC-COMMIT';
    
    // Receive some stock to have on-hand inventory
    await (resolvers.Mutation as any).receiveStock(null, { sku, locationId: loc, amount: 20 });

    // Allocate stock
    const allocated = await (resolvers.Mutation as any).allocateStock(null, { sku, locationId: loc, amount: 8 });
    expect(allocated.sku).toBe(sku);
    expect(allocated.quantity).toBe(20);
    expect(allocated.allocated).toBe(8);
    expect(allocated.available).toBe(12);

    // Trying to allocate more than available should throw
    await expect(
      (resolvers.Mutation as any).allocateStock(null, { sku, locationId: loc, amount: 15 })
    ).rejects.toThrow(/Insufficient available stock/);

    // Release some allocation
    const released = await (resolvers.Mutation as any).releaseAllocation(null, { sku, locationId: loc, amount: 3 });
    expect(released.allocated).toBe(5);
    expect(released.available).toBe(15);

    // Fulfill some allocation (ships stock)
    const fulfilled = await (resolvers.Mutation as any).fulfillAllocation(null, { sku, locationId: loc, amount: 4 });
    expect(fulfilled.allocated).toBe(1);
    expect(fulfilled.quantity).toBe(16);
    expect(fulfilled.available).toBe(15);

    // Create in-transit stock
    const transitCreated = await (resolvers.Mutation as any).createInTransit(null, { sku, locationId: loc, amount: 10 });
    expect(transitCreated.inTransit).toBe(10);
    expect(transitCreated.available).toBe(25);

    // Receive in-transit stock
    const transitReceived = await (resolvers.Mutation as any).receiveInTransit(null, { sku, locationId: loc, amount: 6 });
    expect(transitReceived.inTransit).toBe(4);
    expect(transitReceived.quantity).toBe(22);
    expect(transitReceived.available).toBe(25);
  });

  it('should query historical stock levels through the event sourced ledger resolver', async () => {
    const sku = 'SKU-HIST';
    const loc = 'LOC-HIST';
    const productRepo = require('../../../src/infrastructure/graphql/resolvers').productRepository;
    const { Product } = require('../../../src/domain/entities/Product');
    const { ProductId } = require('../../../src/domain/valueObjects/ProductId');
    const { ProductVariant } = require('../../../src/domain/entities/ProductVariant');
    const { ProductVariantId } = require('../../../src/domain/valueObjects/ProductVariantId');
    const { VariantAttributeSet } = require('../../../src/domain/valueObjects/VariantAttributeSet');
    const { VariantAttribute } = require('../../../src/domain/valueObjects/VariantAttribute');
    const { Sku } = require('../../../src/domain/valueObjects/Sku');

    const map = new Map();
    const v = new ProductVariant(
      new ProductVariantId('v-hist'),
      new ProductId('p-hist'),
      new Sku(sku),
      new VariantAttributeSet([new VariantAttribute('color', 'blue')])
    );
    map.set(v.id.value, v);
    const p = new Product(new ProductId('p-hist'), 'Hist Product', map);
    await productRepo.save(p);

    const t1 = new Date('2026-06-01T10:00:00Z');
    const t2 = new Date('2026-06-01T11:00:00Z');

    // Perform ledger mutations at simulated historical times
    jest.useFakeTimers({ now: t1 });
    await (resolvers.Mutation as any).receiveStock(null, { sku, locationId: loc, amount: 15 });

    jest.useFakeTimers({ now: t2 });
    await (resolvers.Mutation as any).dispatchStock(null, { sku, locationId: loc, amount: 5 });

    jest.useRealTimers();

    // Query historical balances via GraphQL Query
    const beforeT1 = await (resolvers.Query as any).historicalStockLevel(null, {
      sku,
      locationId: loc,
      timestamp: '2026-06-01T09:00:00Z'
    });
    expect(beforeT1).toBe(0);

    const atT1 = await (resolvers.Query as any).historicalStockLevel(null, {
      sku,
      locationId: loc,
      timestamp: '2026-06-01T10:30:00Z'
    });
    expect(atT1).toBe(15);

    const atT2 = await (resolvers.Query as any).historicalStockLevel(null, {
      sku,
      locationId: loc,
      timestamp: '2026-06-01T11:30:00Z'
    });
    expect(atT2).toBe(10);
  });
});
