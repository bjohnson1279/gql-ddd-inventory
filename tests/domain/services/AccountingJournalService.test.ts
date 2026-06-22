import { AccountingJournalService } from '../../../src/domain/services/AccountingJournalService';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { JournalEntry } from '../../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../../src/domain/valueObjects/JournalEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { DebitCredit } from '../../../src/domain/enums/AccountingEnums';

class MockJournalRepo implements IJournalRepository {
  public entries: JournalEntry[] = [];
  async save(entry: JournalEntry): Promise<void> {
    this.entries.push(entry);
  }
  async findById(id: JournalEntryId): Promise<JournalEntry | null> {
    return this.entries.find(e => e.id.equals(id)) || null;
  }
  async findAllByTenant(tenantId: TenantId): Promise<JournalEntry[]> {
    return this.entries.filter(e => e.tenantId.equals(tenantId));
  }
}

describe('AccountingJournalService', () => {
  let repo: MockJournalRepo;
  let service: AccountingJournalService;

  beforeEach(() => {
    repo = new MockJournalRepo();
    service = new AccountingJournalService(repo);
  });

  describe('onStockReturned', () => {
    it('should create and save a balanced journal entry for stock return', async () => {
      const variantId = 'V1';
      const totalCostCents = 1500;
      const referenceId = 'REF-123';
      const date = new Date('2024-01-01T10:00:00Z');
      const tenantId = 'T1';

      const entry = await service.onStockReturned(variantId, totalCostCents, referenceId, date, tenantId);

      expect(entry).toBeDefined();
      expect(entry.isBalanced()).toBe(true);
      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.description).toContain(`Inventory return receipt`);
      expect(entry.description).toContain(`variant ${variantId}`);
      expect(entry.description).toContain(`reference ${referenceId}`);

      const lines = entry.lines;
      expect(lines).toHaveLength(2);

      // Verify Debit to Inventory
      const inventoryLine = lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Debit);

      // Verify Credit to COGS
      const cogsLine = lines.find(l => l.account.code === AccountCode.costOfGoodsSold().code);
      expect(cogsLine).toBeDefined();
      expect(cogsLine?.amountCents).toBe(totalCostCents);
      expect(cogsLine?.type).toBe(DebitCredit.Credit);

      // Verify it was saved to the repository
      expect(repo.entries).toHaveLength(1);
      expect(repo.entries[0]).toBe(entry);
    });
  });

  describe('onInventoryWriteOff', () => {
    it('should create and save a balanced journal entry for inventory write-off', async () => {
      const referenceId = 'WRITE-OFF-456';
      const totalCostCents = 5000;
      const date = new Date('2024-02-01T10:00:00Z');
      const tenantId = 'T2';

      const entry = await service.onInventoryWriteOff(referenceId, totalCostCents, date, tenantId);

      expect(entry).toBeDefined();
      expect(entry.isBalanced()).toBe(true);
      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.description).toContain(`Inventory Write-Off`);
      expect(entry.description).toContain(`Ref ${referenceId}`);

      const lines = entry.lines;
      expect(lines).toHaveLength(2);

      // Verify Debit to Inventory Write-Off Expense
      const expenseLine = lines.find(l => l.account.code === AccountCode.inventoryWriteOffExpense().code);
      expect(expenseLine).toBeDefined();
      expect(expenseLine?.amountCents).toBe(totalCostCents);
      expect(expenseLine?.type).toBe(DebitCredit.Debit);

      // Verify Credit to Inventory
      const inventoryLine = lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Credit);

      // Verify it was saved to the repository
      expect(repo.entries).toHaveLength(1);
      expect(repo.entries[0]).toBe(entry);
    });
  });

  describe('onReturnToVendor', () => {
    it('should create and save a balanced journal entry for return to vendor', async () => {
      const referenceId = 'RTV-789';
      const totalCostCents = 12000;
      const date = new Date('2024-03-01T10:00:00Z');
      const tenantId = 'T3';

      const entry = await service.onReturnToVendor(referenceId, totalCostCents, date, tenantId);

      expect(entry).toBeDefined();
      expect(entry.isBalanced()).toBe(true);
      expect(entry.tenantId.value).toBe(tenantId);
      expect(entry.referenceId).toBe(referenceId);
      expect(entry.description).toContain(`Return to Vendor`);
      expect(entry.description).toContain(`Ref ${referenceId}`);

      const lines = entry.lines;
      expect(lines).toHaveLength(2);

      // Verify Debit to Accounts Payable
      const apLine = lines.find(l => l.account.code === AccountCode.accountsPayable().code);
      expect(apLine).toBeDefined();
      expect(apLine?.amountCents).toBe(totalCostCents);
      expect(apLine?.type).toBe(DebitCredit.Debit);

      // Verify Credit to Inventory
      const inventoryLine = lines.find(l => l.account.code === AccountCode.inventory().code);
      expect(inventoryLine).toBeDefined();
      expect(inventoryLine?.amountCents).toBe(totalCostCents);
      expect(inventoryLine?.type).toBe(DebitCredit.Credit);

      // Verify it was saved to the repository
      expect(repo.entries).toHaveLength(1);
      expect(repo.entries[0]).toBe(entry);
    });
  });

  describe('createEntry (private method error handling)', () => {
    it('should throw an error if the created entry is not balanced', async () => {
      const originalIsBalanced = JournalEntry.prototype.isBalanced;
      JournalEntry.prototype.isBalanced = jest.fn().mockReturnValue(false);

      const variantId = 'V1';
      const totalCostCents = 1500;
      const referenceId = 'REF-123';
      const date = new Date('2024-01-01T10:00:00Z');
      const tenantId = 'T1';

      await expect(
        service.onStockReturned(variantId, totalCostCents, referenceId, date, tenantId)
      ).rejects.toThrow('Journal entry is unbalanced. Debits must equal Credits.');

      expect(repo.entries).toHaveLength(0);

      JournalEntry.prototype.isBalanced = originalIsBalanced;
    });
  });
});
