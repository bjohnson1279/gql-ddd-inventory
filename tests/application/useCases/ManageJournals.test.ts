import { CreateJournalEntryUseCase, CreateJournalEntryInput } from '../../../src/application/useCases/ManageJournals';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { AccountingMethod, DebitCredit } from '../../../src/domain/enums/AccountingEnums';

describe('ManageJournals Use Cases', () => {
  let mockJournalRepo: jest.Mocked<IJournalRepository>;

  beforeEach(() => {
    mockJournalRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn()
    };
  });

  describe('CreateJournalEntryUseCase', () => {
    it('should successfully create and save a balanced journal entry', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J1',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test balanced entry',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '1000', // Asset
            amountCents: 1000,
            type: DebitCredit.Debit,
            memo: 'Debit side'
          },
          {
            accountCode: '4000', // Revenue
            amountCents: 1000,
            type: DebitCredit.Credit,
            memo: 'Credit side'
          }
        ]
      };

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(mockJournalRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when creating an unbalanced journal entry', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J2',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test unbalanced entry',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '1000', // Asset
            amountCents: 1000,
            type: DebitCredit.Debit,
            memo: 'Debit side'
          },
          {
            accountCode: '4000', // Revenue
            amountCents: 800, // Not equal to debit
            type: DebitCredit.Credit,
            memo: 'Credit side'
          }
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });
  });
});
