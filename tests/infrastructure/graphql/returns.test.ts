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
      saveBatch: jest.fn(async (items) => {
        for (const item of items) {
          const idx = layers.findIndex(l => l.id.equals(item.id));
          if (idx !== -1) {
            layers[idx] = item;
          } else {
            layers.push(item);
          }
        }
      }),
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
      consumeFifoLayers: jest.fn(async (variantId, quantity) => {
        const active = layers.filter(l => l.variantId.equals(variantId) && l.consumedQuantity < l.initialQuantity);
        let remaining = quantity;
        let totalCostCents = 0;
        for (const layer of active) {
          const avail = layer.initialQuantity - layer.consumedQuantity;
          const take = Math.min(avail, remaining);
          layer.consumedQuantity += take;
          totalCostCents += take * layer.unitCostCents;
          remaining -= take;
          if (remaining === 0) break;
        }
        return { totalCostCents };
      }),
      findBySerial: jest.fn(async (variantId, serialNumber) => {
        return layers.find(l => l.variantId.equals(variantId) && l.serialNumber?.equals(serialNumber)) || null;
      })
    }))
  };
});
jest.mock('../../../src/infrastructure/persistence/PostgresJournalRepository', () => {
  return { PostgresJournalRepository: jest.fn().mockImplementation(() => {
    const map = new Map();
    return {
      save: jest.fn(async (entry) => { map.set(entry.id.value, entry); }),
      saveBatch: jest.fn(async (entries) => {
        for (const entry of entries) {
          map.set(entry.id.value, entry);
        }
      }),
      findById: jest.fn(async (id) => map.get(id.value) || null),
      findAllByTenant: jest.fn(async (tenantId) => Array.from(map.values()).filter((e: any) => e.tenantId.equals(tenantId) || e.tenantId.value === tenantId))
    };
  }) };
});
let mockRmaRepoInstance: any;
jest.mock('../../../src/infrastructure/persistence/PostgresRmaRepository', () => {
  const { InMemoryRmaRepository } = require('../../../src/infrastructure/persistence/InMemoryRmaRepository');
  return {
    PostgresRmaRepository: jest.fn().mockImplementation(() => {
      const instance = new InMemoryRmaRepository();
      mockRmaRepoInstance = instance;
      return instance;
    })
  };
});
let mockQuarantineRepoInstance: any;
jest.mock('../../../src/infrastructure/persistence/PostgresQuarantineRepository', () => {
  const { InMemoryQuarantineRepository } = require('../../../src/infrastructure/persistence/InMemoryQuarantineRepository');
  return {
    PostgresQuarantineRepository: jest.fn().mockImplementation(() => {
      const instance = new InMemoryQuarantineRepository();
      mockQuarantineRepoInstance = instance;
      return instance;
    })
  };
});

import { resolvers, prisma, pool, productRepository } from '../../../src/infrastructure/graphql/resolvers';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { SerializedItem } from '../../../src/domain/entities/SerializedItem';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { SerializedItemStatus } from '../../../src/domain/enums/SerializedItemStatus';

jest.spyOn(prisma, '$disconnect').mockImplementation(() => Promise.resolve());
jest.spyOn(pool, 'end').mockImplementation(() => Promise.resolve());

describe('GraphQL Returns and Quarantine Resolvers', () => {
  const tenantId = 'tenant-123';
  const locationId = 'LOC-1';
  let variantId: string;

  const adminContext = {
    auth: { tenantId, actorId: 'admin-1', role: 'admin' },
    prisma: {} as any
  };

  const viewerContext = {
    auth: { tenantId, actorId: 'viewer-1', role: 'viewer' },
    prisma: {} as any
  };

  beforeAll(async () => {
    // Register product & variant in repository
    const product = new Product(new ProductId('prod-1'), 'Test Return Product');
    const variant = product.addVariant(new Sku('SKU-RETURN-1'), [
      new VariantAttribute('temperatureZone', 'ambient')
    ]);
    variantId = variant.id.value;
    await productRepository.save(product);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should deny mutating resolvers for viewer role', async () => {
      await expect(
        (resolvers.Mutation as any).createRma(null, {
          input: {
            rmaNumber: 'RMA-100',
            tenantId,
            customerId: 'cust-1',
            locationId,
            items: [{ variantId, quantity: 2, unitCostCents: 1000 }]
          }
        }, viewerContext)
      ).rejects.toThrow('Forbidden: You do not have permission to perform this action.');

      await expect(
        (resolvers.Mutation as any).authorizeRma(null, { id: 'some-id' }, viewerContext)
      ).rejects.toThrow('Forbidden: You do not have permission to perform this action.');

      await expect(
        (resolvers.Mutation as any).receiveRma(null, {
          input: {
            rmaId: 'some-id',
            items: [{ variantId, quantityReceived: 2, disposition: 'RESTOCK' }]
          }
        }, viewerContext)
      ).rejects.toThrow('Forbidden: You do not have permission to perform this action.');

      await expect(
        (resolvers.Mutation as any).resolveQuarantineItem(null, { id: 'some-id', resolution: 'RESTOCK' }, viewerContext)
      ).rejects.toThrow('Forbidden: You do not have permission to perform this action.');
    });
  });

  describe('RMA and Quarantine Lifecycles', () => {
    it('should create and authorize an RMA', async () => {
      const rma = await (resolvers.Mutation as any).createRma(null, {
        input: {
          rmaNumber: 'RMA-101',
          tenantId,
          customerId: 'cust-1',
          locationId,
          items: [{ variantId, quantity: 5, unitCostCents: 1200 }]
        }
      }, adminContext);

      expect(rma.rmaNumber).toBe('RMA-101');
      expect(rma.status).toBe('REQUESTED');
      expect(rma.items.length).toBe(1);
      expect(rma.items[0].variantId).toBe(variantId);

      const authResult = await (resolvers.Mutation as any).authorizeRma(null, { id: rma.id }, adminContext);
      expect(authResult).toBe(true);

      const updatedRma = await (resolvers.Query as any).rma(null, { id: rma.id }, adminContext);
      expect(updatedRma.status).toBe('AUTHORIZED');
    });

    it('should receive RMA with RESTOCK disposition', async () => {
      const rma = await (resolvers.Mutation as any).createRma(null, {
        input: {
          rmaNumber: 'RMA-102',
          tenantId,
          customerId: 'cust-1',
          locationId,
          items: [{ variantId, quantity: 3, unitCostCents: 1500 }]
        }
      }, adminContext);

      await (resolvers.Mutation as any).authorizeRma(null, { id: rma.id }, adminContext);

      const receiveResult = await (resolvers.Mutation as any).receiveRma(null, {
        input: {
          rmaId: rma.id,
          items: [{ variantId, quantityReceived: 3, disposition: 'RESTOCK' }]
        }
      }, adminContext);

      expect(receiveResult).toBe(true);

      // Verify RMA status is completed/received
      const updatedRma = await (resolvers.Query as any).rma(null, { id: rma.id }, adminContext);
      expect(updatedRma.status).toBe('COMPLETED');
      expect(updatedRma.items[0].receivedQuantity).toBe(3);
      expect(updatedRma.items[0].status).toBe('RECEIVED');

      // Verify inventory level has incremented
      const invItem = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku: 'SKU-RETURN-1', locationId }, adminContext);
      expect(invItem.quantity).toBe(3);

      // Verify double-entry journals are created (cash/accrual check)
      const journals = await (resolvers.Query as any).journalEntries(null, { tenantId }, adminContext);
      expect(journals.length).toBeGreaterThan(0);
    });

    it('should receive RMA with QUARANTINE disposition and then resolve quarantine restock', async () => {
      const rma = await (resolvers.Mutation as any).createRma(null, {
        input: {
          rmaNumber: 'RMA-103',
          tenantId,
          customerId: 'cust-1',
          locationId,
          items: [{ variantId, quantity: 4, unitCostCents: 2000 }]
        }
      }, adminContext);

      await (resolvers.Mutation as any).authorizeRma(null, { id: rma.id }, adminContext);

      const receiveResult = await (resolvers.Mutation as any).receiveRma(null, {
        input: {
          rmaId: rma.id,
          items: [{ variantId, quantityReceived: 4, disposition: 'QUARANTINE' }]
        }
      }, adminContext);

      expect(receiveResult).toBe(true);

      // Check quarantine stock location level
      const qInvItem = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku: 'SKU-RETURN-1', locationId: `${locationId}-quarantine` }, adminContext);
      expect(qInvItem.quantity).toBe(4);

      // Fetch quarantine items
      const qItems = await (resolvers.Query as any).quarantineItems(null, { tenantId }, adminContext);
      const qItem = qItems.find((qi: any) => qi.variantId === variantId && qi.status === 'QUARANTINED');
      expect(qItem).toBeDefined();
      expect(qItem.quantity).toBe(4);

      // Resolve via restock
      const resolveResult = await (resolvers.Mutation as any).resolveQuarantineItem(null, { id: qItem.id, resolution: 'RESTOCK' }, adminContext);
      expect(resolveResult).toBe(true);

      // Verify quarantine stock location is decremented
      const qInvItemAfter = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku: 'SKU-RETURN-1', locationId: `${locationId}-quarantine` }, adminContext);
      expect(qInvItemAfter.quantity).toBe(0);

      // Verify main location stock is incremented (previous restock 3 + current restock 4 = 7)
      const mainInvItem = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku: 'SKU-RETURN-1', locationId }, adminContext);
      expect(mainInvItem.quantity).toBe(7);

      // Verify quarantine item status updated
      const resolvedItem = await (resolvers.Query as any).quarantineItem(null, { id: qItem.id }, adminContext);
      expect(resolvedItem.status).toBe('RESTOCKED');
      expect(resolvedItem.resolvedAt).not.toBeNull();
    });
  });
});
