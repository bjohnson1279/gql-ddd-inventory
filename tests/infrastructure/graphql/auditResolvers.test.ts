import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => {
  const mockPrisma: any = {
    $transaction: jest.fn(async (callback: any) => await callback(mockPrisma)),
    integrationConnection: {
      findMany: jest.fn()
    },
    externalMapping: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    productVariant: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    ledgerEntry: {
      aggregate: jest.fn(),
      groupBy: jest.fn()
    },
    journalEntry: {
      findMany: jest.fn()
    },
    quickbooksJournalMapping: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    xeroJournalMapping: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    netsuiteJournalMapping: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    auditDiscrepancy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    outboxEvent: {
      create: jest.fn()
    }
  };
  return {
    prisma: mockPrisma
  };
});


describe('GraphQL Audit Management Resolvers', () => {
  const context = {
    auth: {
      tenantId: 'tenant-1',
      actorId: 'admin-actor',
      role: 'admin'
    },
    prisma
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query auditDiscrepancies successfully', async () => {
    const findManyMock = prisma.auditDiscrepancy.findMany as jest.Mock;
    findManyMock.mockResolvedValueOnce([
      {
        id: 'disc-1',
        tenantId: 'tenant-1',
        type: 'SHOPIFY_STOCK_MISMATCH',
        referenceId: 'VAR-X:LOC-A',
        externalRefId: 'ext-sec-1',
        description: 'Stock mismatch',
        status: 'OPEN',
        occurredAt: new Date(),
        resolvedAt: null,
        resolutionNotes: null
      }
    ]);

    const result = await resolvers.Query.auditDiscrepancies(null, { tenantId: 'tenant-1', status: 'OPEN' }, context);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('disc-1');
    expect(result[0].type).toBe('SHOPIFY_STOCK_MISMATCH');
  });

  it('should runAudit and detect Shopify and accounting discrepancies', async () => {
    // 1. Mock active Shopify connections
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'conn-1', tenantId: 'tenant-1', platform: 'Shopify', isActive: true, storeDomain: 'test.myshopify.com', accessToken: 'mock-token' }
    ]).mockResolvedValueOnce([ // Called again during accounting audit
      { id: 'conn-2', tenantId: 'tenant-1', platform: 'QuickBooks', isActive: true }
    ]);

    // 2. Mock variant and location mapping
    (prisma.externalMapping.findMany as jest.Mock)
      .mockResolvedValueOnce([ // variant mappings
        { id: 'map-1', integrationId: 'conn-1', entityType: 'VARIANT', internalId: 'var-1', externalSecondaryId: 'ext-sec-1' }
      ])
      .mockResolvedValueOnce([ // location mappings
        { id: 'map-2', integrationId: 'conn-1', entityType: 'LOCATION', internalId: 'loc-1', externalId: 'ext-loc-1' }
      ]);

    // 3. Mock product variant sku resolving
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValueOnce([{
      id: 'var-1',
      sku: 'SKU-DIFF' // Ends with -DIFF to mock mismatch
    }]);

    // 4. Mock ledger quantities
    (prisma.ledgerEntry.groupBy as jest.Mock).mockResolvedValueOnce([{
      variantId: 'var-1', locationId: 'loc-1', _sum: { quantity: 10 }
    }]);

    // 5. Mock open check findMany
    (prisma.auditDiscrepancy.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // Shopify open check prefetch
      .mockResolvedValueOnce([]); // Accounting open check prefetch

    // 6. Mock recent journal entries
    (prisma.journalEntry.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'je-1', tenantId: 'tenant-1', description: 'Journal 1', createdAt: new Date() }
    ]);

    // 7. Mock mappings lookup
    (prisma.quickbooksJournalMapping.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.xeroJournalMapping.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.netsuiteJournalMapping.findMany as jest.Mock).mockResolvedValueOnce([]);

    const summary = await resolvers.Mutation.runAudit(null, { tenantId: 'tenant-1' }, context);
    expect(summary.shopifyDiscrepancies).toBe(1);
    expect(summary.accountingDiscrepancies).toBe(1);

    expect(prisma.auditDiscrepancy.create).toHaveBeenCalledTimes(2);
  });

  it('should resolveAuditDiscrepancy successfully', async () => {
    (prisma.auditDiscrepancy.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'disc-1',
      tenantId: 'tenant-1',
      type: 'ACCOUNTING_JOURNAL_MISSING',
      referenceId: 'je-1',
      status: 'OPEN'
    });

    const resolved = await resolvers.Mutation.resolveAuditDiscrepancy(null, { id: 'disc-1', notes: 'Manually verified' }, context);
    expect(resolved).toBe(true);
    expect(prisma.auditDiscrepancy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'disc-1' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolutionNotes: 'Manually verified'
        })
      })
    );
  });
});
