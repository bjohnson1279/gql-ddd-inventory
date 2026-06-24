import { AccountingJournalService } from '../../../src/domain/services/AccountingJournalService';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { DebitCredit, AccountingMethod } from '../../../src/domain/enums/AccountingEnums';
import { JournalEntry } from '../../../src/domain/entities/JournalEntry';

describe('AccountingJournalService', () => {
  let mockJournalRepo: jest.Mocked<IJournalRepository>;
  let service: AccountingJournalService;

  beforeEach(() => {
    mockJournalRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByTenant: jest.fn()
    } as unknown as jest.Mocked<IJournalRepository>;
    service = new AccountingJournalService(mockJournalRepo);
  });

  describe('onReturnToVendor', () => {
    it('should create and save a balanced journal entry for returning to vendor', async () => {
      const referenceId = 'PO-12345';
      const totalCostCents = 15000;
      const date = new Date('2023-10-01T10:00:00Z');
      const tenantId = 'tenant-xyz';

      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      expect(mockJournalRepo.save).toHaveBeenCalledTimes(1);
      expect(mockJournalRepo.save).toHaveBeenCalledWith(entry);

      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.date).toEqual(date);
      expect(entry.description).toBe(`Return to Vendor — Ref ${referenceId}`);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.method).toBe(AccountingMethod.Accrual);

      const lines = entry.lines;
      expect(lines).toHaveLength(2);

      const apLine = lines.find(l => l.account.code === AccountCode.accountsPayable().code);
      expect(apLine).toBeDefined();
      expect(apLine?.amountCents).toBe(totalCostCents);
      expect(apLine?.type).toBe(DebitCredit.Debit);
      expect(apLine?.memo).toBe('AP cleared — return to vendor');

      const inventoryLine = lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Credit);
      expect(inventoryLine?.memo).toBe('Inventory reduction');

      expect(entry.isBalanced()).toBe(true);
    });
  });

  describe('createEntry (private method)', () => {
    it('should throw an error when attempting to create an unbalanced journal entry', async () => {
      const tenantId = 'tenant-xyz';
      const date = new Date('2023-10-01T10:00:00Z');
      const description = 'Test unbalanced entry';
      const method = AccountingMethod.Accrual;
      const lines: [AccountCode, number, DebitCredit, string][] = [
        [AccountCode.inventory(), 15000, DebitCredit.Debit, 'Debit amount'],
        [AccountCode.costOfGoodsSold(), 10000, DebitCredit.Credit, 'Mismatched credit amount'],
      ];

      await expect(
        (service as any).createEntry(tenantId, date, description, null, method, lines)
      ).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
    });
  });
});
