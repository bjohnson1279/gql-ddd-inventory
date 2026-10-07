import { JournalLine } from '../../../src/domain/entities/JournalLine';
import { AccountCode } from '../../../src/domain/valueObjects/AccountCode';
import { DebitCredit } from '../../../src/domain/enums/AccountingEnums';

describe('JournalLine', () => {
  describe('constructor', () => {
    it('should create a JournalLine with valid inputs and default memo', () => {
      const account = AccountCode.cash();
      const line = new JournalLine(account, 1000, DebitCredit.Debit);

      expect(line.account).toBe(account);
      expect(line.amountCents).toBe(1000);
      expect(line.type).toBe(DebitCredit.Debit);
      expect(line.memo).toBe('');
    });

    it('should create a JournalLine with a custom memo', () => {
      const account = AccountCode.salesRevenue();
      const line = new JournalLine(account, 5000, DebitCredit.Credit, 'Sale of merchandise');

      expect(line.account).toBe(account);
      expect(line.amountCents).toBe(5000);
      expect(line.type).toBe(DebitCredit.Credit);
      expect(line.memo).toBe('Sale of merchandise');
    });

    it('should throw an error when amountCents is zero', () => {
      const account = AccountCode.cash();
      expect(() => new JournalLine(account, 0, DebitCredit.Debit))
        .toThrow('Journal line amount must be positive.');
    });

    it('should throw an error when amountCents is negative', () => {
      const account = AccountCode.cash();
      expect(() => new JournalLine(account, -100, DebitCredit.Debit))
        .toThrow('Journal line amount must be positive.');
    });
  });
});
