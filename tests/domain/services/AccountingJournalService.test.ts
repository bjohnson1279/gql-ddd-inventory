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

  describe('onStockReturned', () => {
    it('should create and save a balanced journal entry for stock return', async () => {
      const variantId = 'var-123';
      const totalCostCents = 25000;
      const referenceId = 'RET-999';
      const date = new Date('2023-10-02T10:00:00Z');
      const tenantId = 'tenant-xyz';

      const entry = await service.onStockReturned(variantId, totalCostCents, referenceId, date, tenantId);

      expect(mockJournalRepo.save).toHaveBeenCalledTimes(1);
      expect(mockJournalRepo.save).toHaveBeenCalledWith(entry);

      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.date).toEqual(date);
      expect(entry.description).toBe(`Inventory return receipt — variant ${variantId} — reference ${referenceId}`);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.method).toBe(AccountingMethod.Accrual);

      const lines = entry.lines;
      expect(lines).toHaveLength(2);

      const inventoryLine = lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Debit);
      expect(inventoryLine?.memo).toBe('Returned stock');

      const cogsLine = lines.find(l => l.account.code === AccountCode.costOfGoodsSold().code);
      expect(cogsLine).toBeDefined();
      expect(cogsLine?.amountCents).toBe(totalCostCents);
      expect(cogsLine?.type).toBe(DebitCredit.Credit);
      expect(cogsLine?.memo).toBe('COGS reversal');

      expect(entry.isBalanced()).toBe(true);
    });

    it('should throw an error for zero cost entries', async () => {
      const variantId = 'var-123';
      const totalCostCents = 0;
      const referenceId = 'RET-ZERO';
      const date = new Date('2023-10-02T10:00:00Z');
      const tenantId = 'tenant-abc';

      await expect(
        service.onStockReturned(variantId, totalCostCents, referenceId, date, tenantId)
      ).rejects.toThrow('Journal line amount must be positive.');

      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('onInventoryWriteOff', () => {
    const referenceId = 'WO-12345';
    const totalCostCents = 15000;
    const date = new Date('2023-10-01T10:00:00Z');
    const tenantId = 'tenant-xyz';

    it('should save the journal entry to the repository', async () => {
      const entry = await service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId);

      expect(mockJournalRepo.save).toHaveBeenCalledTimes(1);
      expect(mockJournalRepo.save).toHaveBeenCalledWith(entry);
    });

    it('should set the basic properties of the journal entry', async () => {
      const entry = await service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId);

      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.date).toEqual(date);
      expect(entry.description).toBe(`Inventory Write-Off — Ref ${referenceId}`);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.method).toBe(AccountingMethod.Accrual);
    });

    it('should create an Inventory Write-Off Expense debit line', async () => {
      const entry = await service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId);

      const expenseLine = entry.lines.find(l => l.account.code === AccountCode.inventoryWriteOffExpense().code);
      expect(expenseLine).toBeDefined();
      expect(expenseLine?.amountCents).toBe(totalCostCents);
      expect(expenseLine?.type).toBe(DebitCredit.Debit);
      expect(expenseLine?.memo).toBe('Inventory write-off');
    });

    it('should create an Inventory credit line', async () => {
      const entry = await service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId);

      const inventoryLine = entry.lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Credit);
      expect(inventoryLine?.memo).toBe('Inventory reduction');
    });

    it('should result in a balanced journal entry', async () => {
      const entry = await service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId);

      expect(entry.isBalanced()).toBe(true);
    });

    it('should throw an error for zero cost entries', async () => {
      const referenceId = 'WO-ZERO';
      const totalCostCents = 0;
      const date = new Date('2023-10-02T10:00:00Z');
      const tenantId = 'tenant-abc';

      await expect(
        service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId)
      ).rejects.toThrow('Journal line amount must be positive.');

      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });

    it('should correctly handle missing referenceId', async () => {
      const entry = await service.onInventoryWriteOff('', totalCostCents, date, tenantId);

      expect(entry.description).toBe('Inventory Write-Off — Ref ');
      expect(entry.referenceId).toBeUndefined();
    });

    it('should correctly handle negative cost entries', async () => {
      const referenceId = 'WO-NEGATIVE';
      const negativeCostCents = -15000;
      const date = new Date('2023-10-02T10:00:00Z');
      const tenantId = 'tenant-abc';

      await expect(
        service.onInventoryWriteOff(referenceId, negativeCostCents, date, tenantId)
      ).rejects.toThrow('Journal line amount must be positive.');

      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('onReturnToVendor', () => {
    const referenceId = 'PO-12345';
    const totalCostCents = 15000;
    const date = new Date('2023-10-01T10:00:00Z');
    const tenantId = 'tenant-xyz';

    it('should save the journal entry to the repository', async () => {
      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      expect(mockJournalRepo.save).toHaveBeenCalledTimes(1);
      expect(mockJournalRepo.save).toHaveBeenCalledWith(entry);
    });

    it('should set the basic properties of the journal entry', async () => {
      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.date).toEqual(date);
      expect(entry.description).toBe(`Return to Vendor — Ref ${referenceId}`);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.method).toBe(AccountingMethod.Accrual);
    });

    it('should create an Accounts Payable debit line', async () => {
      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      const apLine = entry.lines.find(l => l.account.code === AccountCode.accountsPayable().code);
      expect(apLine).toBeDefined();
      expect(apLine?.amountCents).toBe(totalCostCents);
      expect(apLine?.type).toBe(DebitCredit.Debit);
      expect(apLine?.memo).toBe('AP cleared — return to vendor');
    });

    it('should create an Inventory credit line', async () => {
      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      const inventoryLine = entry.lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Credit);
      expect(inventoryLine?.memo).toBe('Inventory reduction');
    });

    it('should result in a balanced journal entry', async () => {
      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      expect(entry.isBalanced()).toBe(true);
    });

    it('should throw an error for zero cost entries', async () => {
      const referenceId = 'PO-ZERO';
      const totalCostCents = 0;
      const date = new Date('2023-10-02T10:00:00Z');
      const tenantId = 'tenant-abc';

      await expect(
        service.onReturnToVendor(referenceId, totalCostCents, date, tenantId)
      ).rejects.toThrow('Journal line amount must be positive.');

      expect(mockJournalRepo.save).not.toHaveBeenCalled();
    });

    it('should correctly handle missing referenceId', async () => {
      const entry = await service.onReturnToVendor('', totalCostCents, date, tenantId);

      expect(entry.description).toBe('Return to Vendor — Ref ');
      expect(entry.referenceId).toBeUndefined();
    });

    it('should correctly handle negative cost entries', async () => {
      const referenceId = 'PO-NEGATIVE';
      const negativeCostCents = -15000;
      const date = new Date('2023-10-02T10:00:00Z');
      const tenantId = 'tenant-abc';

      await expect(
        service.onReturnToVendor(referenceId, negativeCostCents, date, tenantId)
      ).rejects.toThrow('Journal line amount must be positive.');

      expect(mockJournalRepo.save).not.toHaveBeenCalled();
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

    it('should throw an error when creating an entry with only one line', async () => {
      const tenantId = 'tenant-xyz';
      const date = new Date('2023-10-01T10:00:00Z');
      const description = 'Test unbalanced entry with one line';
      const method = AccountingMethod.Accrual;
      const lines: [AccountCode, number, DebitCredit, string][] = [
        [AccountCode.inventory(), 15000, DebitCredit.Debit, 'Debit amount']
      ];

      await expect(
        (service as any).createEntry(tenantId, date, description, null, method, lines)
      ).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');
    });
  });
});
