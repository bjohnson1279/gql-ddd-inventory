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
jest.mock('../../../src/infrastructure/persistence/PostgresJournalRepository', () => {
  return { PostgresJournalRepository: jest.fn().mockImplementation(() => {
    const map = new Map();
    return {
      save: jest.fn(async (entry) => { map.set(entry.id.value, entry); }),
      findById: jest.fn(async (id) => map.get(id.value) || null),
      findAllByTenant: jest.fn(async (tenantId) => Array.from(map.values()).filter((e: any) => e.tenantId.equals(tenantId) || e.tenantId.value === tenantId))
    };
  }) };
});
jest.mock('../../../src/infrastructure/persistence/PostgresWarehouseLocationRepository', () => {
  const { InMemoryWarehouseLocationRepository } = require('../../../src/infrastructure/persistence/InMemoryWarehouseLocationRepository');
  return { PostgresWarehouseLocationRepository: InMemoryWarehouseLocationRepository };
});

const dbShipments: any[] = [];
const dbOutboxEvents: any[] = [];

import { resolvers, prisma, pool, productRepository } from '../../../src/infrastructure/graphql/resolvers';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import crypto from 'crypto';

jest.spyOn(prisma, '$disconnect').mockImplementation(() => Promise.resolve());
jest.spyOn(pool, 'end').mockImplementation(() => Promise.resolve());

jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));

jest.spyOn((prisma as any).shipment, 'upsert').mockImplementation(async (args: any) => {
  const { id } = args.where;
  const idx = dbShipments.findIndex(s => s.id === id);
  const data = idx !== -1 ? { ...dbShipments[idx], ...args.update } : { ...args.create };
  if (idx !== -1) {
    dbShipments[idx] = data;
  } else {
    dbShipments.push(data);
  }
  return { ...data };
});

jest.spyOn((prisma as any).shipment, 'findUnique').mockImplementation(async (args: any) => {
  const { id } = args.where;
  const match = dbShipments.find(s => s.id === id);
  return match ? { ...match } : null;
});

jest.spyOn((prisma as any).shipment, 'findMany').mockImplementation(async (args: any) => {
  return dbShipments.map(s => ({ ...s }));
});

jest.spyOn((prisma as any).outboxEvent, 'create').mockImplementation(async (args: any) => {
  const event = { id: crypto.randomUUID(), ...args.data };
  dbOutboxEvents.push(event);
  return event;
});

describe('GraphQL Shipping Resolvers', () => {
  const tenantId = 'tenant-123';
  const locationId = 'LOC-1';
  const sku = 'SKU-SHIPPING-1';
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
    // 1. Create a product and a variant
    const product = new Product(new ProductId('prod-shipping-1'), 'Test Shipping Product');
    const variant = product.addVariant(new Sku(sku), [
      new VariantAttribute('weight', 'medium')
    ]);
    variantId = variant.id.value;
    await productRepository.save(product);

    // 2. Set up initial stock level of 100 for shipping tests
    await (resolvers.Mutation as any).receiveStock(
      null,
      { sku, locationId, amount: 100 },
      adminContext
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should deny mutating resolvers for viewer role', async () => {
      await expect(
        (resolvers.Mutation as any).purchaseShippingLabel(null, {
          sku,
          quantity: 2,
          destinationAddress: '123 Test St, Denver, CO',
          carrier: 'UPS Ground',
          locationId,
          tenantId
        }, viewerContext)
      ).rejects.toThrow('Forbidden: You do not have permission to perform this action.');

      await expect(
        (resolvers.Mutation as any).updateShipmentStatus(null, {
          shipmentId: 'some-shipment-id',
          status: 'in_transit'
        }, viewerContext)
      ).rejects.toThrow('Forbidden: You do not have permission to perform this action.');
    });
  });

  describe('Shipping Rates & Label Purchases', () => {
    it('should fetch shipping rates', async () => {
      const rates = await (resolvers.Query as any).shippingRates(null, {
        sku,
        quantity: 2,
        destinationAddress: '123 Test St, Denver, CO'
      }, adminContext);

      expect(rates.length).toBeGreaterThan(0);
      expect(rates.some((r: any) => r.carrier === 'UPS Ground')).toBe(true);
    });

    it('should purchase shipping label, decrement inventory, post ledger journal, and log outbox', async () => {
      // Current inventory before purchase is 100
      const invBefore = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku, locationId }, adminContext);
      expect(invBefore.quantity).toBe(100);

      const result = await (resolvers.Mutation as any).purchaseShippingLabel(null, {
        sku,
        quantity: 5,
        destinationAddress: '123 Test St, Denver, CO',
        carrier: 'UPS Ground',
        locationId,
        tenantId
      }, adminContext);

      expect(result.shipmentId).toBeDefined();
      expect(result.trackingNumber).toContain('1Z999AA1012345');
      expect(result.labelUrl).toContain('.pdf');
      expect(result.rateCents).toBeGreaterThan(0);

      // Verify inventory decremented: 100 - 5 = 95
      const invAfter = await (resolvers.Query as any).inventoryItemBySkuAndLocation(null, { sku, locationId }, adminContext);
      expect(invAfter.quantity).toBe(95);

      // Verify shipment record in db
      const list = await (resolvers.Query as any).shipments(null, {}, adminContext);
      const match = list.find((s: any) => s.id === result.shipmentId);
      expect(match).toBeDefined();
      expect(match.status).toBe('label_generated');
      expect(match.sku).toBe(sku);

      // Verify outbox event logged
      const outboxMatch = dbOutboxEvents.find(e => e.eventType === 'ShipmentCreatedEvent' && e.payload.includes(result.shipmentId));
      expect(outboxMatch).toBeDefined();

      // Verify journal entries
      const journals = await (resolvers.Query as any).journalEntries(null, { tenantId }, adminContext);
      expect(journals.length).toBeGreaterThan(0);
      const shippingJournal = journals.find((j: any) => j.referenceId === result.shipmentId);
      expect(shippingJournal).toBeDefined();
      expect(shippingJournal.lines.some((l: any) => l.accountCode === '5400' && l.type === 'debit')).toBe(true);
      expect(shippingJournal.lines.some((l: any) => l.accountCode === '2100' && l.type === 'credit')).toBe(true);
    });

    it('should fail shipping label purchase on insufficient inventory', async () => {
      await expect(
        (resolvers.Mutation as any).purchaseShippingLabel(null, {
          sku,
          quantity: 200,
          destinationAddress: '123 Test St, Denver, CO',
          carrier: 'UPS Ground',
          locationId,
          tenantId
        }, adminContext)
      ).rejects.toThrow(/insufficient stock/i);
    });

    it('should update shipment tracking status', async () => {
      const list = await (resolvers.Query as any).shipments(null, {}, adminContext);
      const shipment = list[0];
      expect(shipment).toBeDefined();

      const updateResult = await (resolvers.Mutation as any).updateShipmentStatus(null, {
        shipmentId: shipment.id,
        status: 'in_transit'
      }, adminContext);

      expect(updateResult).toBe(true);

      const listAfter = await (resolvers.Query as any).shipments(null, {}, adminContext);
      const match = listAfter.find((s: any) => s.id === shipment.id);
      expect(match.status).toBe('in_transit');

      // Verify outbox status update event logged
      const outboxMatch = dbOutboxEvents.find(e => e.eventType === 'ShipmentStatusUpdatedEvent' && e.payload.includes('in_transit'));
      expect(outboxMatch).toBeDefined();
    });
  });
});
