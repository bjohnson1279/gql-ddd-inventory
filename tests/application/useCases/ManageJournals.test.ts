import { CreateJournalEntryUseCase, CreateJournalEntryInput, GetJournalEntriesUseCase } from '../../../src/application/useCases/ManageJournals';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { AccountingMethod, DebitCredit } from '../../../src/domain/enums/AccountingEnums';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { JournalEntry } from '../../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../../src/domain/valueObjects/JournalEntryId';

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


    it('should throw an error when creating a journal entry with only debits', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J3',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test debit-only entry',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '1000', // Asset
            amountCents: 1000,
            type: DebitCredit.Debit,
            memo: 'Debit side 1'
          },
          {
            accountCode: '5000', // Expense
            amountCents: 500,
            type: DebitCredit.Debit,
            memo: 'Debit side 2'
          }
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });

    it('should throw an error when an entry line amount is not positive', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J5',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test negative amount entry',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '1000',
            amountCents: -500,
            type: DebitCredit.Debit,
            memo: 'Invalid debit'
          },
          {
            accountCode: '4000',
            amountCents: -500,
            type: DebitCredit.Credit,
            memo: 'Invalid credit'
          }
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Journal line amount must be positive.');
      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate error if journalRepo.save fails', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J6',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test repo save failure',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '1000',
            amountCents: 500,
            type: DebitCredit.Debit,
            memo: 'Debit side'
          },
          {
            accountCode: '4000',
            amountCents: 500,
            type: DebitCredit.Credit,
            memo: 'Credit side'
          }
        ]
      };

      mockJournalRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute(input)).rejects.toThrow('Database error');
      expect(mockJournalRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw an error specifically testing when debits not equal to credits', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J7',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test purely debits not equal to credits',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '1000',
            amountCents: 200,
            type: DebitCredit.Debit,
            memo: 'Debit'
          },
          {
            accountCode: '4000',
            amountCents: 300,
            type: DebitCredit.Credit,
            memo: 'Credit'
          }
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });

    it('should throw an error when creating a journal entry with only credits', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J4',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test credit-only entry',
        method: AccountingMethod.Accrual,
        lines: [
          {
            accountCode: '4000', // Revenue
            amountCents: 1000,
            type: DebitCredit.Credit,
            memo: 'Credit side 1'
          },
          {
            accountCode: '4000', // Revenue
            amountCents: 500,
            type: DebitCredit.Credit,
            memo: 'Credit side 2'
          }
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
      expect(mockJournalRepo.save).not.toHaveBeenCalled();
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

    it('should throw an error when creating an unbalanced journal entry (credits > debits)', async () => {
      const useCase = new CreateJournalEntryUseCase(mockJournalRepo);

      const input: CreateJournalEntryInput = {
        id: 'J3',
        tenantId: 'T1',
        date: new Date().toISOString(),
        description: 'Test unbalanced entry credits higher',
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
            amountCents: 1200, // Credits greater than debit
            type: DebitCredit.Credit,
            memo: 'Credit side'
          }
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('GetJournalEntriesUseCase', () => {
    it('should retrieve all journal entries for a given tenant', async () => {
      const useCase = new GetJournalEntriesUseCase(mockJournalRepo);

      const mockEntry = new JournalEntry(
        new JournalEntryId('J1'),
        new TenantId('T1'),
        new Date(),
        'Test Entry',
        AccountingMethod.Accrual
      );

      mockJournalRepo.findAllByTenant.mockResolvedValue([mockEntry]);

      const result = await useCase.execute('T1');

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockEntry);
      expect(mockJournalRepo.findAllByTenant).toHaveBeenCalledWith(expect.any(TenantId));

      const capturedTenantId = mockJournalRepo.findAllByTenant.mock.calls[0][0];
      expect(capturedTenantId.value).toBe('T1');
    });
  });
});
