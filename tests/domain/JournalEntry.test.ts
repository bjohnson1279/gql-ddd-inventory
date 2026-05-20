import { JournalEntry } from '../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../src/domain/valueObjects/JournalEntryId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { AccountCode } from '../../src/domain/valueObjects/AccountCode';
import { DebitCredit, AccountingMethod, AccountCategory } from '../../src/domain/enums/AccountingEnums';

describe('JournalEntry', () => {
  const tenantId = new TenantId('T1');
  const date = new Date();
  const description = 'Test Entry';

  it('should be balanced when debits equal credits', () => {
    const entry = new JournalEntry(
      new JournalEntryId('J1'),
      tenantId,
      date,
      description,
      AccountingMethod.Accrual
    );

    entry.addLine(AccountCode.inventory(), 1000, DebitCredit.Debit);
    entry.addLine(AccountCode.accountsPayable(), 1000, DebitCredit.Credit);

    expect(entry.isBalanced()).toBe(true);
  });

  it('should not be balanced when debits do not equal credits', () => {
    const entry = new JournalEntry(
      new JournalEntryId('J1'),
      tenantId,
      date,
      description,
      AccountingMethod.Accrual
    );

    entry.addLine(AccountCode.inventory(), 1000, DebitCredit.Debit);
    entry.addLine(AccountCode.accountsPayable(), 900, DebitCredit.Credit);

    expect(entry.isBalanced()).toBe(false);
  });

  it('should throw error when adding a line with non-positive amount', () => {
    const entry = new JournalEntry(
      new JournalEntryId('J1'),
      tenantId,
      date,
      description,
      AccountingMethod.Accrual
    );

    expect(() => {
      entry.addLine(AccountCode.inventory(), 0, DebitCredit.Debit);
    }).toThrow('Journal line amount must be positive.');

    expect(() => {
      entry.addLine(AccountCode.inventory(), -100, DebitCredit.Debit);
    }).toThrow('Journal line amount must be positive.');
  });

  it('should correctly identify account categories', () => {
    const cashAccount = AccountCode.cash();
    expect(cashAccount.category).toBe(AccountCategory.Asset);

    const revenueAccount = AccountCode.salesRevenue();
    expect(revenueAccount.category).toBe(AccountCategory.Revenue);
  });
});
