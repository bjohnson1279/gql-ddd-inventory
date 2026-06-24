import { JournalEntryId } from '../valueObjects/JournalEntryId';
import { TenantId } from '../valueObjects/TenantId';
import { JournalLine } from './JournalLine';
import { AccountCode } from '../valueObjects/AccountCode';
import { DebitCredit, AccountingMethod } from '../enums/AccountingEnums';

export class JournalEntry {
  private _lines: JournalLine[] = [];

  constructor(
    public readonly id: JournalEntryId,
    public readonly tenantId: TenantId,
    public readonly date: Date,
    public readonly description: string,
    public readonly method: AccountingMethod,
    public readonly referenceId?: string
  ) {}

  addLine(
    account: AccountCode,
    amountCents: number,
    type: DebitCredit,
    memo: string = ''
  ): void {
    this._lines.push(new JournalLine(account, amountCents, type, memo));
  }

  get lines(): ReadonlyArray<JournalLine> {
    return this._lines;
  }

  isBalanced(): boolean {
    const debits = this._lines
      .filter(l => l.type === DebitCredit.Debit)
      .reduce((sum, l) => sum + l.amountCents, 0);
    const credits = this._lines
      .filter(l => l.type === DebitCredit.Credit)
      .reduce((sum, l) => sum + l.amountCents, 0);
    return debits === credits;
  }
}
