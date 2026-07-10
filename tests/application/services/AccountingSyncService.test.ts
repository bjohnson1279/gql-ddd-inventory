import { PrismaClient } from '@prisma/client';
import {
  NetSuiteJournalSync,
  XeroJournalSync,
  QuickBooksJournalSync,
  NetSuiteMappingRepository,
  XeroMappingRepository,
  QuickBooksMappingRepository
} from '../../../src/application/services/AccountingSyncService';

describe('AccountingSyncService', () => {
  describe('Integration Mock Clients', () => {
    describe('NetSuiteJournalSync', () => {
      it('should return mock id when account or token contains mock', async () => {
        const sync = new NetSuiteJournalSync('mock-account', 'mock-token');
        const id = await sync.createJournalEntry('desc', 'ref1', []);
        expect(id).toMatch(/^mock-netsuite-journal-[a-f0-9]{8}$/);
      });

      it('should return real id when valid account and token are provided', async () => {
        const sync = new NetSuiteJournalSync('valid-account', 'valid-token');
        const id = await sync.createJournalEntry('desc', 'ref1', []);
        expect(id).toMatch(/^ns-journal-[a-f0-9]{8}$/);
      });
    });

    describe('XeroJournalSync', () => {
      it('should return mock id when tenant or token contains mock', async () => {
        const sync = new XeroJournalSync('mock-tenant', 'mock-token');
        const id = await sync.createManualJournal('desc', 'ref1', []);
        expect(id).toMatch(/^mock-xero-journal-[a-f0-9]{8}$/);
      });

      it('should return real id when valid tenant and token are provided', async () => {
        const sync = new XeroJournalSync('valid-tenant', 'valid-token');
        const id = await sync.createManualJournal('desc', 'ref1', []);
        expect(id).toMatch(/^xero-journal-[a-f0-9]{8}$/);
      });
    });

    describe('QuickBooksJournalSync', () => {
      it('should return mock id when realm or token contains mock', async () => {
        const sync = new QuickBooksJournalSync('mock-realm', 'mock-token');
        const id = await sync.createJournalEntry('desc', 'ref1', []);
        expect(id).toMatch(/^mock-qbo-journal-[a-f0-9]{8}$/);
      });

      it('should return real id when valid realm and token are provided', async () => {
        const sync = new QuickBooksJournalSync('valid-realm', 'valid-token');
        const id = await sync.createJournalEntry('desc', 'ref1', []);
        expect(id).toMatch(/^qbo-journal-[a-f0-9]{8}$/);
      });
    });
  });

  describe('Prisma Mapping Repositories', () => {
    let prismaMock: jest.Mocked<PrismaClient>;

    beforeEach(() => {
      prismaMock = {
        netsuiteJournalMapping: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
        },
        xeroJournalMapping: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
        },
        quickbooksJournalMapping: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
        },
      } as unknown as jest.Mocked<PrismaClient>;
    });

    describe('NetSuiteMappingRepository', () => {
      let repo: NetSuiteMappingRepository;

      beforeEach(() => {
        repo = new NetSuiteMappingRepository(prismaMock);
      });

      it('should save mapping via upsert', async () => {
        await repo.saveMapping('journal-1', 'ns-1');
        expect(prismaMock.netsuiteJournalMapping.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { journalEntryId: 'journal-1' },
            create: expect.objectContaining({
              journalEntryId: 'journal-1',
              netsuiteJournalId: 'ns-1',
            }),
            update: { netsuiteJournalId: 'ns-1' },
          })
        );
      });

      it('should find net suite journal id', async () => {
        (prismaMock.netsuiteJournalMapping.findUnique as jest.Mock).mockResolvedValue({
          netsuiteJournalId: 'ns-1',
        });
        const result = await repo.findNetSuiteJournalId('journal-1');
        expect(result).toBe('ns-1');
        expect(prismaMock.netsuiteJournalMapping.findUnique).toHaveBeenCalledWith({
          where: { journalEntryId: 'journal-1' },
        });
      });

      it('should return null when finding net suite journal id if not found', async () => {
        (prismaMock.netsuiteJournalMapping.findUnique as jest.Mock).mockResolvedValue(null);
        const result = await repo.findNetSuiteJournalId('journal-1');
        expect(result).toBeNull();
      });
    });

    describe('XeroMappingRepository', () => {
      let repo: XeroMappingRepository;

      beforeEach(() => {
        repo = new XeroMappingRepository(prismaMock);
      });

      it('should save mapping via upsert', async () => {
        await repo.saveMapping('journal-1', 'xero-1');
        expect(prismaMock.xeroJournalMapping.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { journalEntryId: 'journal-1' },
            create: expect.objectContaining({
              journalEntryId: 'journal-1',
              xeroJournalId: 'xero-1',
            }),
            update: { xeroJournalId: 'xero-1' },
          })
        );
      });

      it('should find xero journal id', async () => {
        (prismaMock.xeroJournalMapping.findUnique as jest.Mock).mockResolvedValue({
          xeroJournalId: 'xero-1',
        });
        const result = await repo.findXeroJournalId('journal-1');
        expect(result).toBe('xero-1');
        expect(prismaMock.xeroJournalMapping.findUnique).toHaveBeenCalledWith({
          where: { journalEntryId: 'journal-1' },
        });
      });

      it('should return null when finding xero journal id if not found', async () => {
        (prismaMock.xeroJournalMapping.findUnique as jest.Mock).mockResolvedValue(null);
        const result = await repo.findXeroJournalId('journal-1');
        expect(result).toBeNull();
      });
    });

    describe('QuickBooksMappingRepository', () => {
      let repo: QuickBooksMappingRepository;

      beforeEach(() => {
        repo = new QuickBooksMappingRepository(prismaMock);
      });

      it('should save mapping via upsert', async () => {
        await repo.saveMapping('journal-1', 'qbo-1');
        expect(prismaMock.quickbooksJournalMapping.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { journalEntryId: 'journal-1' },
            create: expect.objectContaining({
              journalEntryId: 'journal-1',
              quickbooksJournalId: 'qbo-1',
            }),
            update: { quickbooksJournalId: 'qbo-1' },
          })
        );
      });

      it('should find quickbooks journal id', async () => {
        (prismaMock.quickbooksJournalMapping.findUnique as jest.Mock).mockResolvedValue({
          quickbooksJournalId: 'qbo-1',
        });
        const result = await repo.findQuickBooksJournalId('journal-1');
        expect(result).toBe('qbo-1');
        expect(prismaMock.quickbooksJournalMapping.findUnique).toHaveBeenCalledWith({
          where: { journalEntryId: 'journal-1' },
        });
      });

      it('should return null when finding quickbooks journal id if not found', async () => {
        (prismaMock.quickbooksJournalMapping.findUnique as jest.Mock).mockResolvedValue(null);
        const result = await repo.findQuickBooksJournalId('journal-1');
        expect(result).toBeNull();
      });
    });
  });
});
