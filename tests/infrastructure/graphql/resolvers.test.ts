jest.mock('pg', () => {
  const mClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [], fields: [], rowCount: 0 }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  const mPool = {
    connect: jest.fn().mockResolvedValue(mClient),
    query: jest.fn().mockResolvedValue({ rows: [], fields: [], rowCount: 0 }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  const mTypes = {
    getTypeParser: jest.fn().mockReturnValue(() => {}),
    setTypeParser: jest.fn(),
    builtins: {},
  };
  return {
    Pool: jest.fn(() => mPool),
    Client: jest.fn(() => mClient),
    types: mTypes,
  };
});

jest.mock('../../../src/infrastructure/persistence/PostgresInventoryRepository', () => {
  const { InMemoryInventoryRepository } = require('../../../src/infrastructure/persistence/InMemoryInventoryRepository');
  return { PostgresInventoryRepository: InMemoryInventoryRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresProductRepository', () => {
  const { InMemoryProductRepository } = require('../../../src/infrastructure/persistence/InMemoryProductRepository');
  return { PostgresProductRepository: InMemoryProductRepository };
});
let mockLedgerRepoInstance: any;
jest.mock('../../../src/infrastructure/persistence/PostgresLedgerRepository', () => {
  const { InMemoryLedgerRepository } = require('../../../src/infrastructure/persistence/InMemoryLedgerRepository');
  return {
    PostgresLedgerRepository: jest.fn().mockImplementation(() => {
      const instance = new InMemoryLedgerRepository();
      mockLedgerRepoInstance = instance;
      return instance;
    })
  };
});
jest.mock('../../../src/infrastructure/persistence/PostgresSerializedItemRepository', () => {
  const { InMemorySerializedItemRepository } = require('../../../src/infrastructure/persistence/InMemorySerializedItemRepository');
  return { PostgresSerializedItemRepository: InMemorySerializedItemRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresInventoryCostLayerRepository', () => {
  const layers: any[] = [];
  return {
    PostgresInventoryCostLayerRepository: jest.fn().mockImplementation(() => ({
      save: jest.fn(async (layer) => {
        const idx = layers.findIndex(l => l.id.equals(layer.id));
        if (idx !== -1) {
          layers[idx] = layer;
        } else {
          layers.push(layer);
        }
      }),
      getActiveLayers: jest.fn(async (variantId, orderBy) => {
        const filtered = layers.filter(l => l.variantId.equals(variantId) && l.consumedQuantity < l.initialQuantity);
        const isExpiration = orderBy?.toLowerCase().includes('expiration');
        const orderDirection = orderBy?.toLowerCase().includes('desc') ? 'desc' : 'asc';
        return [...filtered].sort((a, b) => {
          if (isExpiration) {
            const expA = a.lot?.expirationDate?.getTime() || Infinity;
            const expB = b.lot?.expirationDate?.getTime() || Infinity;
            if (expA !== expB) {
              return orderDirection === 'desc' ? expB - expA : expA - expB;
            }
          }
          const timeA = a.receivedAt.getTime();
          const timeB = b.receivedAt.getTime();
          return orderDirection === 'desc' ? timeB - timeA : timeA - timeB;
        });
      }),
      findBySerial: jest.fn(async (variantId, serialNumber) => {
        return layers.find(l => l.variantId.equals(variantId) && l.serialNumber?.equals(serialNumber)) || null;
      })
    }))
  };
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
jest.mock('../../../src/infrastructure/persistence/PostgresStockTransferRepository', () => {
  const { InMemoryStockTransferRepository } = require('../../../src/infrastructure/persistence/InMemoryStockTransferRepository');
  return { PostgresStockTransferRepository: InMemoryStockTransferRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresReplenishmentRuleRepository', () => {
  const { InMemoryReplenishmentRuleRepository } = require('../../../src/infrastructure/persistence/InMemoryReplenishmentRuleRepository');
  return { PostgresReplenishmentRuleRepository: InMemoryReplenishmentRuleRepository };
});
jest.mock('../../../src/infrastructure/persistence/PostgresPurchaseOrderRepository', () => {
  const { InMemoryPurchaseOrderRepository } = require('../../../src/infrastructure/persistence/InMemoryPurchaseOrderRepository');
  return { PostgresPurchaseOrderRepository: InMemoryPurchaseOrderRepository };
});

import { setTimeout } from 'timers';
import { resolvers, prisma, pool, productRepository, warehouseLocationRepository } from '../../../src/infrastructure/graphql/resolvers';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { WarehouseLocation } from '../../../src/domain/entities/WarehouseLocation';

jest.spyOn(prisma.inventoryItem, 'deleteMany').mockImplementation(() => Promise.resolve({ count: 0 }) as any);
jest.spyOn(prisma, '$connect').mockImplementation(() => Promise.resolve());
jest.spyOn(prisma, '$disconnect').mockImplementation(() => Promise.resolve());

const mockNotifications: any[] = [];
jest.spyOn(prisma.ledgerEntry, 'findFirst').mockResolvedValue({ tenantId: 'tenant-1' } as any);
jest.spyOn(prisma.notification, 'findMany').mockImplementation(async (args?: any) => {
  const tenantId = args?.where?.tenantId;
  let list = mockNotifications;
  if (tenantId) {
    list = list.filter(n => n.tenantId === tenantId);
  }
  return list;
});
jest.spyOn(prisma.notification, 'create').mockImplementation(async (args: any) => {
  const data = args.data;
  const newNotification = {
    id: data.id || 'notif-id',
    tenantId: data.tenantId,
    title: data.title,
    message: data.message,
    type: data.type || 'info',
    isRead: data.isRead ?? false,
    createdAt: new Date()
  };
  mockNotifications.push(newNotification);
  return newNotification;
});
jest.spyOn(prisma.notification, 'update').mockImplementation(async (args: any) => {
  const id = args.where.id;
  const data = args.data;
  const idx = mockNotifications.findIndex(n => n.id === id);
  if (idx !== -1) {
    mockNotifications[idx] = { ...mockNotifications[idx], ...data };
    return mockNotifications[idx];
  }
  return null;
});
jest.spyOn(prisma.notification, 'updateMany').mockImplementation(async (args: any) => {
  const tenantId = args?.where?.tenantId;
  const isRead = args?.where?.isRead;
  const data = args.data;
  let count = 0;
  mockNotifications.forEach((n, idx) => {
    if ((!tenantId || n.tenantId === tenantId) && (isRead === undefined || n.isRead === isRead)) {
      mockNotifications[idx] = { ...n, ...data };
      count++;
    }
  });
  return { count };
});

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

  it('should support creating, querying, dispatching, receiving, and cancelling stock transfers through GraphQL resolvers', async () => {
    const context = {
      auth: {
        tenantId: 't-resolver',
        actorId: 'user-resolver',
        role: 'warehouse_operator'
      }
    };

    // We need a product variant in the mock product repository to find sku.
    const productRepo = require('../../../src/infrastructure/graphql/resolvers').productRepository;
    const { Product } = require('../../../src/domain/entities/Product');
    const { ProductId } = require('../../../src/domain/valueObjects/ProductId');
    const { Sku } = require('../../../src/domain/valueObjects/Sku');
    const { VariantAttribute } = require('../../../src/domain/valueObjects/VariantAttribute');
    const { VariantTrackingMode } = require('../../../src/domain/enums/VariantEnums');

    const product = new Product(new ProductId('p-resolver'), 'Resolver Product');
    const variant = product.addVariant(new Sku('SKU-RESOLVER'), [new VariantAttribute('color', 'red')], VariantTrackingMode.Quantity);
    await productRepo.save(product);

    // 1. Create stock transfer
    const transferInput = {
      tenantId: 't-resolver',
      sourceLocationId: 'LOC-RESOLVER-A',
      destinationLocationId: 'LOC-RESOLVER-B',
      items: [{ variantId: variant.id.value, quantity: 8 }],
      referenceId: 'ref-res-1'
    };

    const created = await (resolvers.Mutation as any).createStockTransfer(null, { input: transferInput }, context);
    expect(created.id).toBeDefined();
    expect(created.status).toBe('draft');
    expect(created.items).toHaveLength(1);
    expect(created.items[0].variantId).toBe(variant.id.value);

    // 2. Query stock transfer by ID
    const retrieved = await (resolvers.Query as any).stockTransfer(null, { id: created.id }, context);
    expect(retrieved).not.toBeNull();
    expect(retrieved.status).toBe('draft');
    expect(retrieved.referenceId).toBe('ref-res-1');

    // 3. Query all stock transfers by tenant
    const transfers = await (resolvers.Query as any).stockTransfers(null, { tenantId: 't-resolver' }, context);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].id).toBe(created.id);

    // Seed inventory at source so we can dispatch
    await (resolvers.Mutation as any).receiveStock(null, { sku: 'SKU-RESOLVER', locationId: 'LOC-RESOLVER-A', amount: 20 }, context);

    // 4. Dispatch stock transfer
    const dispatched = await (resolvers.Mutation as any).dispatchStockTransfer(null, {
      id: created.id,
      actorId: 'user-resolver',
      tenantId: 't-resolver'
    }, context);
    expect(dispatched.status).toBe('dispatched');
    expect(dispatched.dispatchedAt).not.toBeNull();

    // Verify source stock is reduced (20 - 8 = 12)
    const sourceInv = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku: 'SKU-RESOLVER', locationId: 'LOC-RESOLVER-A' }, context);
    expect(sourceInv.quantity).toBe(12);

    // 5. Receive stock transfer
    const received = await (resolvers.Mutation as any).receiveStockTransfer(null, {
      id: created.id,
      actorId: 'user-resolver',
      tenantId: 't-resolver'
    }, context);
    expect(received.status).toBe('received');
    expect(received.receivedAt).not.toBeNull();

    // Verify destination stock is increased (8)
    const destInv = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku: 'SKU-RESOLVER', locationId: 'LOC-RESOLVER-B' }, context);
    expect(destInv.quantity).toBe(8);

    // 6. Create and cancel a second stock transfer
    const transferInput2 = {
      tenantId: 't-resolver',
      sourceLocationId: 'LOC-RESOLVER-A',
      destinationLocationId: 'LOC-RESOLVER-B',
      items: [{ variantId: variant.id.value, quantity: 2 }]
    };
    const created2 = await (resolvers.Mutation as any).createStockTransfer(null, { input: transferInput2 }, context);
    const cancelled = await (resolvers.Mutation as any).cancelStockTransfer(null, {
      id: created2.id,
      actorId: 'user-resolver',
      tenantId: 't-resolver'
    }, context);
    expect(cancelled.status).toBe('cancelled');
  });

  it('should support creating and managing replenishment rules and purchase orders via GraphQL resolvers', async () => {
    const context = {
      auth: {
        tenantId: 't-replenish-resolver',
        actorId: 'user-replenish-resolver',
        role: 'warehouse_operator'
      }
    };

    const productRepo = require('../../../src/infrastructure/graphql/resolvers').productRepository;
    const { Product } = require('../../../src/domain/entities/Product');
    const { ProductId } = require('../../../src/domain/valueObjects/ProductId');
    const { Sku } = require('../../../src/domain/valueObjects/Sku');
    const { VariantAttribute } = require('../../../src/domain/valueObjects/VariantAttribute');
    const { VariantTrackingMode } = require('../../../src/domain/enums/VariantEnums');

    const product = new Product(new ProductId('p-rep-res'), 'Replenish Resolver Product');
    const variant = product.addVariant(new Sku('SKU-REP-RESOLVER'), [new VariantAttribute('color', 'green')], VariantTrackingMode.Quantity);
    await productRepo.save(product);

    // 1. Create replenishment rule
    const ruleInput = {
      tenantId: 't-replenish-resolver',
      sku: 'SKU-REP-RESOLVER',
      locationId: 'LOC-REP-RESOLVER-A',
      reorderPoint: 15,
      reorderQuantity: 80,
      safetyStock: 5,
      leadTimeDays: 5,
      replenishmentType: 'SUPPLIER',
      supplierId: 'SUPP-RESOLVER',
      dynamicRopEnabled: false
    };

    const createdRule = await (resolvers.Mutation as any).createReplenishmentRule(null, { input: ruleInput }, context);
    expect(createdRule.id).toBeDefined();
    expect(createdRule.sku).toBe('SKU-REP-RESOLVER');
    expect(createdRule.isActive).toBe(true);

    // 2. Toggle active
    const toggledRule = await (resolvers.Mutation as any).toggleReplenishmentRule(null, { id: createdRule.id, isActive: false }, context);
    expect(toggledRule.isActive).toBe(false);

    // Toggle back to active
    await (resolvers.Mutation as any).toggleReplenishmentRule(null, { id: createdRule.id, isActive: true }, context);

    // 3. Query replenishment rules
    const rules = await (resolvers.Query as any).replenishmentRules(null, { tenantId: 't-replenish-resolver' }, context);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(createdRule.id);

    // 4. Create purchase order
    const poInput = {
      tenantId: 't-replenish-resolver',
      supplierId: 'SUPP-RESOLVER',
      destinationLocationId: 'LOC-REP-RESOLVER-A',
      items: [{ variantId: variant.id.value, quantity: 50 }]
    };

    const createdPo = await (resolvers.Mutation as any).createPurchaseOrder(null, { input: poInput }, context);
    expect(createdPo.id).toBeDefined();
    expect(createdPo.status).toBe('DRAFT');

    // 5. Query PO by ID
    const retrievedPo = await (resolvers.Query as any).purchaseOrder(null, { id: createdPo.id }, context);
    expect(retrievedPo).not.toBeNull();
    expect(retrievedPo.supplierId).toBe('SUPP-RESOLVER');

    // 6. Query all POs for tenant
    const pos = await (resolvers.Query as any).purchaseOrders(null, { tenantId: 't-replenish-resolver' }, context);
    expect(pos).toHaveLength(1);
    expect(pos[0].id).toBe(createdPo.id);

    // 7. Place PO
    const placedPo = await (resolvers.Mutation as any).placePurchaseOrder(null, { id: createdPo.id }, context);
    expect(placedPo.status).toBe('ORDERED');

    // 8. Receive PO
    const receivedPo = await (resolvers.Mutation as any).receivePurchaseOrder(null, {
      id: createdPo.id,
      actorId: 'user-replenish-resolver',
      tenantId: 't-replenish-resolver'
    }, context);
    expect(receivedPo.status).toBe('RECEIVED');

    // 9. Create and cancel PO
    const poInput2 = {
      tenantId: 't-replenish-resolver',
      supplierId: 'SUPP-RESOLVER',
      destinationLocationId: 'LOC-REP-RESOLVER-A',
      items: [{ variantId: variant.id.value, quantity: 20 }]
    };
    const createdPo2 = await (resolvers.Mutation as any).createPurchaseOrder(null, { input: poInput2 }, context);
    const cancelledPo = await (resolvers.Mutation as any).cancelPurchaseOrder(null, { id: createdPo2.id }, context);
    expect(cancelledPo.status).toBe('CANCELLED');

    // 10. Run evaluation
    const evaluated = await (resolvers.Mutation as any).evaluateReplenishment(null, { tenantId: 't-replenish-resolver' }, context);
    expect(evaluated).toBe(true);
  });

  it('should suggest putaway locations and optimize picking routes via GraphQL queries', async () => {
    const context = {
      auth: { tenantId: 't-routing', userId: 'user-routing', role: 'admin' },
      prisma: {} as any
    };

    // 1. Setup mock product variant
    const product = new Product(new ProductId('p-r1'), 'Routing Prod');
    const variant = product.addVariant(new Sku('ROUTE-SKU-1'), [
      new VariantAttribute('temperatureZone', 'ambient')
    ]);
    (variant as any).weightGrams = 100;
    (variant as any).volumeCubicMeters = 0.05;
    await productRepository.save(product);

    // 2. Setup mock locations in repository
    const loc1 = WarehouseLocation.parsePath('WH1-ambient-A01-R01-S01-B01', 1000, 1.0);
    const loc2 = WarehouseLocation.parsePath('WH1-ambient-A02-R01-S01-B01', 1000, 1.0);
    await warehouseLocationRepository.save(loc1);
    await warehouseLocationRepository.save(loc2);

    // 3. Test suggestPutawayLocations query resolver
    const recs = await (resolvers.Query as any).suggestPutawayLocations(
      null,
      { input: { sku: 'ROUTE-SKU-1', quantity: 5 } },
      context
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].locationId).toBe('WH1-ambient-A01-R01-S01-B01');
    expect(recs[0].quantity).toBe(5);

    // 4. Test optimizePickingRoute query resolver
    const route = await (resolvers.Query as any).optimizePickingRoute(
      null,
      {
        tenantId: 't-routing',
        items: [
          { sku: 'ROUTE-SKU-1', quantity: 2, locationId: 'WH1-ambient-A02-R01-S01-B01' },
          { sku: 'ROUTE-SKU-1', quantity: 3, locationId: 'WH1-ambient-A01-R01-S01-B01' }
        ]
      },
      context
    );

    expect(route).toHaveLength(1);
    expect(route[0].warehouseId).toBe('WH1');
    expect(route[0].items).toHaveLength(2);
    // S-Shape route check: A01 is odd (asc), A02 is even (desc)
    expect(route[0].items[0].locationId).toBe('WH1-ambient-A01-R01-S01-B01');
    expect(route[0].items[1].locationId).toBe('WH1-ambient-A02-R01-S01-B01');
  });

  it('should manage FEFO costing and product recall via resolvers', async () => {
    const context = { auth: { role: 'admin', tenantId: 'tenant-fefo', actorId: 'actor-fefo' } };

    // 1. Create product & variant
    await (resolvers.Mutation as any).createProduct(null, { id: 'p-fefo-1', name: 'FEFO Product' }, context);
    await (resolvers.Mutation as any).addProductVariant(null, {
      productId: 'p-fefo-1',
      sku: 'SKU-FEFO-1',
      attributes: [{ name: 'size', value: 'standard' }],
      trackingMode: 'lot'
    }, context);

    // 2. Update costing method to FEFO
    const variant = await (resolvers.Mutation as any).updateProductVariantCostingMethod(
      null,
      { sku: 'SKU-FEFO-1', costingMethod: 'fefo' },
      context
    );
    expect(variant.costingMethod).toBe('fefo');

    // 3. Receive stock with Lot
    const expiry = new Date('2026-12-31T00:00:00.000Z');
    const received = await (resolvers.Mutation as any).receiveStockWithLot(
      null,
      {
        sku: 'SKU-FEFO-1',
        locationId: 'LOC-FEFO-A',
        quantity: 30,
        unitCostCents: 600,
        lotNumber: 'LOT-FEFO-X',
        expirationDate: expiry.toISOString()
      },
      context
    );
    expect(received).toBe(true);

    // 4. Query FEFO Pick Suggestion
    const suggestions = await (resolvers.Query as any).suggestFefoPicking(
      null,
      { sku: 'SKU-FEFO-1', quantity: 15 },
      context
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].lotNumber).toBe('LOT-FEFO-X');
    expect(suggestions[0].locationId).toBe('LOC-FEFO-A');
    expect(suggestions[0].quantity).toBe(15);

    // 5. Trace recall: insert a simulated dispatch ledger entry directly into mock repository
    const dbProduct = await productRepository.findBySku(new Sku('SKU-FEFO-1'));
    expect(dbProduct).not.toBeNull();
    const dbVariant = dbProduct!.variants.find(v => v.sku.value === 'SKU-FEFO-1');
    expect(dbVariant).toBeDefined();

    const { LedgerEntry } = require('../../../src/domain/entities/LedgerEntry');
    const { LedgerEntryId } = require('../../../src/domain/valueObjects/LedgerEntryId');
    const { TenantId } = require('../../../src/domain/valueObjects/TenantId');
    const { LocationId } = require('../../../src/domain/valueObjects/LocationId');
    const { ActorId } = require('../../../src/domain/valueObjects/ActorId');
    const { ReasonCode } = require('../../../src/domain/enums/ReasonCode');

    await mockLedgerRepoInstance.append(new LedgerEntry(
      new LedgerEntryId('le-recall-dispatch-1'),
      new TenantId('tenant-fefo'),
      new LocationId('LOC-FEFO-A'),
      dbVariant!.id,
      -10, // Deduction/dispatch
      ReasonCode.Sale,
      new ActorId('actor-fefo'),
      new Date(),
      'ORDER-FEFO-1',
      { lotNumber: 'LOT-FEFO-X' }
    ));

    const dispatches = await (resolvers.Query as any).traceProductRecall(
      null,
      { lotNumber: 'LOT-FEFO-X' },
      context
    );
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].ledgerEntryId).toBe('le-recall-dispatch-1');
    expect(dispatches[0].quantity).toBe(10);
    expect(dispatches[0].referenceId).toBe('ORDER-FEFO-1');
  });

  describe('Notifications System', () => {
    it('should query, mark as read, and mark all as read for notifications', async () => {
      const context = { auth: { role: 'admin', tenantId: 'tenant-acme' } };

      // Manually add a mock notification
      mockNotifications.push({
        id: 'notif-1',
        tenantId: 'tenant-acme',
        title: 'Low Stock Alert',
        message: 'SKU SKU1 dropped to 5 items',
        type: 'warning',
        isRead: false,
        createdAt: new Date()
      });
      mockNotifications.push({
        id: 'notif-2',
        tenantId: 'tenant-acme',
        title: 'Inventory Reconciled',
        message: 'Variance of 10 recorded',
        type: 'info',
        isRead: false,
        createdAt: new Date()
      });

      // Query notifications
      const notifs = await (resolvers.Query as any).notifications(null, { tenantId: 'tenant-acme' }, context);
      expect(notifs).toHaveLength(2);
      expect(notifs.some((n: any) => n.id === 'notif-1')).toBe(true);
      expect(notifs.some((n: any) => n.id === 'notif-2')).toBe(true);

      // Mark single notification as read
      const markResult = await (resolvers.Mutation as any).markNotificationAsRead(null, { id: 'notif-1' }, context);
      expect(markResult).toBe(true);

      const notifsAfterMark = await (resolvers.Query as any).notifications(null, { tenantId: 'tenant-acme' }, context);
      expect(notifsAfterMark.find((n: any) => n.id === 'notif-1')?.isRead).toBe(true);
      expect(notifsAfterMark.find((n: any) => n.id === 'notif-2')?.isRead).toBe(false);

      // Mark all notifications as read
      const markAllResult = await (resolvers.Mutation as any).markAllNotificationsAsRead(null, { tenantId: 'tenant-acme' }, context);
      expect(markAllResult).toBe(true);

      const notifsAfterMarkAll = await (resolvers.Query as any).notifications(null, { tenantId: 'tenant-acme' }, context);
      expect(notifsAfterMarkAll.every((n: any) => n.isRead)).toBe(true);
    });
  });

  describe('Authentication & User Management', () => {
    let mockUsers: any[] = [];
    let mockTenants: any[] = [];
    let mockRoles: any[] = [];
    let mockUserRoles: any[] = [];

    beforeEach(() => {
      mockUsers = [];
      mockTenants = [];
      mockRoles = [];
      mockUserRoles = [];

      jest.spyOn(prisma.tenant, 'findUnique').mockImplementation((args: any) => {
        const id = args.where.id;
        const tenant = mockTenants.find(t => t.id === id);
        return Promise.resolve(tenant || null) as any;
      });

      jest.spyOn(prisma.tenant, 'create').mockImplementation((args: any) => {
        const newTenant = args.data;
        mockTenants.push(newTenant);
        return Promise.resolve(newTenant) as any;
      });

      jest.spyOn(prisma.role, 'findUnique').mockImplementation((args: any) => {
        const id = args.where.id;
        const role = mockRoles.find(r => r.id === id);
        return Promise.resolve(role || null) as any;
      });

      jest.spyOn(prisma.role, 'create').mockImplementation((args: any) => {
        const newRole = args.data;
        mockRoles.push(newRole);
        return Promise.resolve(newRole) as any;
      });

      jest.spyOn(prisma.user, 'findFirst').mockImplementation((args: any) => {
        const { tenantId, email, id } = args.where;
        const user = mockUsers.find(u => {
          if (tenantId && u.tenantId !== tenantId) return false;
          if (email && u.email !== email) return false;
          if (id && u.id !== id) return false;
          return true;
        });
        if (!user) return Promise.resolve(null) as any;
        const resUser = { ...user };
        if (args.include?.userRoles) {
          resUser.userRoles = mockUserRoles
            .filter(ur => ur.userId === user.id)
            .map(ur => ({
              ...ur,
              role: mockRoles.find(r => r.id === ur.roleId)
            }));
        }
        return Promise.resolve(resUser) as any;
      });

      jest.spyOn(prisma.user, 'findMany').mockImplementation((args: any) => {
        const { tenantId } = args.where;
        const list = mockUsers.filter(u => u.tenantId === tenantId);
        const mappedList = list.map(u => {
          const resUser = { ...u };
          if (args.include?.userRoles) {
            resUser.userRoles = mockUserRoles
              .filter(ur => ur.userId === u.id)
              .map(ur => ({
                ...ur,
                role: mockRoles.find(r => r.id === ur.roleId)
              }));
          }
          return resUser;
        });
        return Promise.resolve(mappedList) as any;
      });

      jest.spyOn(prisma.user, 'create').mockImplementation((args: any) => {
        const newUser = { id: args.data.id || 'new-uuid', ...args.data };
        mockUsers.push(newUser);
        return Promise.resolve(newUser) as any;
      });

      jest.spyOn(prisma.userRole, 'create').mockImplementation((args: any) => {
        const newUserRole = args.data;
        mockUserRoles.push(newUserRole);
        return Promise.resolve(newUserRole) as any;
      });

      jest.spyOn(prisma.userRole, 'deleteMany').mockImplementation((args: any) => {
        const userId = args.where.userId;
        const initialLength = mockUserRoles.length;
        for (let i = mockUserRoles.length - 1; i >= 0; i--) {
          if (mockUserRoles[i].userId === userId) {
            mockUserRoles.splice(i, 1);
          }
        }
        return Promise.resolve({ count: initialLength - mockUserRoles.length }) as any;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw an error when setup is called in production environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect((resolvers.Mutation as any).setup(null, {
        orgName: 'Acme Org',
        tenantId: 'tenant-acme',
        adminName: 'Admin Alice',
        adminEmail: 'alice@acme.com',
        adminPassword: 'Password123!'
      })).rejects.toThrow('Setup mutation is disabled in production environments.');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should setup a new organization and admin user', async () => {
      const result = await (resolvers.Mutation as any).setup(null, {
        orgName: 'Acme Org',
        tenantId: 'tenant-acme',
        adminName: 'Admin Alice',
        adminEmail: 'alice@acme.com',
        adminPassword: 'Password123!'
      });

      expect(result).toBe(true);
      expect(mockTenants).toHaveLength(1);
      expect(mockTenants[0].name).toBe('Acme Org');
      expect(mockUsers).toHaveLength(1);
      expect(mockUsers[0].name).toBe('Admin Alice');
      expect(mockUserRoles).toHaveLength(1);
      expect(mockUserRoles[0].roleId).toBe('admin');
    });

    it('should issue a JWT on successful login and fail on invalid credentials', async () => {
      // Setup first
      await (resolvers.Mutation as any).setup(null, {
        orgName: 'Acme Org',
        tenantId: 'tenant-acme',
        adminName: 'Admin Alice',
        adminEmail: 'alice@acme.com',
        adminPassword: 'Password123!'
      });

      // Login success
      process.env.JWT_SECRET = 'test-secret';
      const token = await (resolvers.Mutation as any).login(null, {
        tenantId: 'tenant-acme',
        email: 'alice@acme.com',
        password: 'Password123!'
      });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Login fail
      await expect(
        (resolvers.Mutation as any).login(null, {
          tenantId: 'tenant-acme',
          email: 'alice@acme.com',
          password: 'WrongPassword!'
        })
      ).rejects.toThrow('Invalid credentials.');
    });

    it('should support inviting users and updating user roles', async () => {
      const context = { auth: { role: 'admin', tenantId: 'tenant-acme' } };

      // Invite user
      const inviteResult = await (resolvers.Mutation as any).inviteUser(null, {
        tenantId: 'tenant-acme',
        email: 'bob@acme.com',
        role: 'warehouse_operator'
      }, context);

      expect(inviteResult.userId).toBeDefined();
      expect(inviteResult.temporaryPassword).toBeDefined();
      expect(mockUsers).toHaveLength(1);
      expect(mockUsers[0].email).toBe('bob@acme.com');
      expect(mockUserRoles).toHaveLength(1);
      expect(mockUserRoles[0].roleId).toBe('warehouse_operator');

      // Update role
      const updateResult = await (resolvers.Mutation as any).updateUserRole(null, {
        tenantId: 'tenant-acme',
        userId: inviteResult.userId,
        role: 'accountant'
      }, context);

      expect(updateResult).toBe(true);
      expect(mockUserRoles).toHaveLength(1);
      expect(mockUserRoles[0].roleId).toBe('accountant');
    });

    it('should list users for a tenant', async () => {
      const context = { auth: { role: 'admin', tenantId: 'tenant-acme' } };

      // Invite user
      const inviteResult = await (resolvers.Mutation as any).inviteUser(null, {
        tenantId: 'tenant-acme',
        email: 'bob@acme.com',
        role: 'warehouse_operator'
      }, context);

      // Query users
      const usersList = await (resolvers.Query as any).users(null, { tenantId: 'tenant-acme' }, context);
      expect(usersList).toHaveLength(1);
      expect(usersList[0].email).toBe('bob@acme.com');
      expect(usersList[0].role).toBe('warehouse_operator');
    });
  });
});
