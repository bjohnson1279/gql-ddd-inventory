import { PostgresJournalRepository } from '../../../src/infrastructure/persistence/PostgresJournalRepository';
import { JournalEntry } from '../../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../../src/domain/valueObjects/JournalEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { AccountingMethod, DebitCredit } from '../../../src/domain/enums/AccountingEnums';

const mockPrisma = {
  $transaction: jest.fn(),
  journalEntry: {
    upsert: jest.fn(),
  },
  journalLine: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

describe('PostgresJournalRepository', () => {
  let repo: PostgresJournalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresJournalRepository(mockPrisma as any);
  });

  describe('saveBatch', () => {
    it('should do nothing when entries array is empty', async () => {
      await repo.saveBatch([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should save a batch of entries efficiently using batch deletes and creates', async () => {
      const tenantId = new TenantId('tenant-1');
      const entry1 = new JournalEntry(
        new JournalEntryId('11111111-1111-1111-1111-111111111111'),
        tenantId,
        new Date(),
        'Entry 1',
        AccountingMethod.Accrual
      );
      entry1.addLine(AccountCode.fromCode('1000'), 100, DebitCredit.Debit);
      entry1.addLine(AccountCode.fromCode('2000'), 100, DebitCredit.Credit);

      const entry2 = new JournalEntry(
        new JournalEntryId('22222222-2222-2222-2222-222222222222'),
        tenantId,
        new Date(),
        'Entry 2',
        AccountingMethod.Accrual
      );
      entry2.addLine(AccountCode.fromCode('1000'), 200, DebitCredit.Debit);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      await repo.saveBatch([entry1, entry2]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
