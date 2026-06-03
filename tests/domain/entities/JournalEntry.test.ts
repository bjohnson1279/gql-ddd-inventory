import { JournalEntry } from '../../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../../src/domain/valueObjects/JournalEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { AccountingMethod, DebitCredit } from '../../../src/domain/enums/AccountingEnums';

describe('JournalEntry Domain Entity', () => {
  it('should initialize correctly and have empty lines', () => {
    const entry = new JournalEntry(
      new JournalEntryId('J1'),
      new TenantId('T1'),
      new Date('2023-01-01'),
      'Initial entry',
      AccountingMethod.Accrual
    );

    expect(entry.id.value).toBe('J1');
    expect(entry.tenantId.value).toBe('T1');
    expect(entry.description).toBe('Initial entry');
    expect(entry.method).toBe(AccountingMethod.Accrual);
    expect(entry.lines).toEqual([]);
    expect(entry.isBalanced()).toBe(true); // 0 === 0
  });

  it('should add lines correctly', () => {
    const entry = new JournalEntry(
      new JournalEntryId('J1'),
      new TenantId('T1'),
      new Date('2023-01-01'),
      'Test entry',
      AccountingMethod.Accrual
    );

    entry.addLine(AccountCode.fromCode('1000'), 100, DebitCredit.Debit, 'Debit memo');

    const lines = entry.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].account.code).toBe('1000');
    expect(lines[0].amountCents).toBe(100);
    expect(lines[0].type).toBe(DebitCredit.Debit);
    expect(lines[0].memo).toBe('Debit memo');
  });

  describe('isBalanced()', () => {
    it('should be balanced when total debits equal total credits', () => {
      const entry = new JournalEntry(
        new JournalEntryId('J1'),
        new TenantId('T1'),
        new Date('2023-01-01'),
        'Test entry',
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.fromCode('1000'), 500, DebitCredit.Debit);
      entry.addLine(AccountCode.fromCode('5000'), 500, DebitCredit.Debit);
      entry.addLine(AccountCode.fromCode('4000'), 1000, DebitCredit.Credit);

      expect(entry.isBalanced()).toBe(true);
    });

    it('should not be balanced when total debits are less than total credits', () => {
      const entry = new JournalEntry(
        new JournalEntryId('J1'),
        new TenantId('T1'),
        new Date('2023-01-01'),
        'Test entry',
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.fromCode('1000'), 500, DebitCredit.Debit);
      entry.addLine(AccountCode.fromCode('4000'), 1000, DebitCredit.Credit);

      expect(entry.isBalanced()).toBe(false);
    });

    it('should not be balanced when total debits are greater than total credits', () => {
      const entry = new JournalEntry(
        new JournalEntryId('J1'),
        new TenantId('T1'),
        new Date('2023-01-01'),
        'Test entry',
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.fromCode('1000'), 1500, DebitCredit.Debit);
      entry.addLine(AccountCode.fromCode('4000'), 1000, DebitCredit.Credit);

      expect(entry.isBalanced()).toBe(false);
    });

    it('should not be balanced when there are only debits', () => {
      const entry = new JournalEntry(
        new JournalEntryId('J1'),
        new TenantId('T1'),
        new Date('2023-01-01'),
        'Test entry',
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.fromCode('1000'), 500, DebitCredit.Debit);
      entry.addLine(AccountCode.fromCode('5000'), 500, DebitCredit.Debit);

      expect(entry.isBalanced()).toBe(false);
    });

    it('should not be balanced when there are only credits', () => {
      const entry = new JournalEntry(
        new JournalEntryId('J1'),
        new TenantId('T1'),
        new Date('2023-01-01'),
        'Test entry',
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.fromCode('4000'), 1000, DebitCredit.Credit);

      expect(entry.isBalanced()).toBe(false);
    });
  });
});
