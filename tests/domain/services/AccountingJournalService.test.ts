import { AccountingJournalService } from '../../../src/domain/services/AccountingJournalService';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { DebitCredit, AccountingMethod } from '../../../src/domain/enums/AccountingEnums';

describe('AccountingJournalService', () => {
  let mockJournalRepo: jest.Mocked<IJournalRepository>;
  let service: AccountingJournalService;

  beforeEach(() => {
    mockJournalRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
    service = new AccountingJournalService(mockJournalRepo);
  });

  describe('onStockReturned', () => {
    it('creates a balanced journal entry', async () => {
      const date = new Date('2023-01-01');
      const entry = await service.onStockReturned('VAR1', 1000, 'REF1', date, 'TENANT1');

      expect(entry.isBalanced()).toBe(true);
      expect(entry.lines.length).toBe(2);
      expect(mockJournalRepo.save).toHaveBeenCalledWith(entry);
    });
  });

  describe('createEntry', () => {
    it('throws an error if the journal entry is unbalanced', async () => {
      const date = new Date('2023-01-01');
      const unbalancedLines: [AccountCode, number, DebitCredit, string][] = [
        [AccountCode.inventory(), 1000, DebitCredit.Debit, 'Debit amount'],
        [AccountCode.costOfGoodsSold(), 500, DebitCredit.Credit, 'Credit amount'],
      ];

      await expect(
        (service as any).createEntry(
          'TENANT1',
          date,
          'Unbalanced Entry',
          'REF1',
          AccountingMethod.Accrual,
          unbalancedLines
        )
      ).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');

      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });
  });
});
