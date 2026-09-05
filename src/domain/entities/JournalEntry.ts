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
    let debits = 0;
    let credits = 0;
    // ⚡ Bolt: Single pass for loop avoids intermediate array allocations from filter/reduce
    for (const l of this._lines) {
      if (l.type === DebitCredit.Debit) debits += l.amountCents;
      else if (l.type === DebitCredit.Credit) credits += l.amountCents;
    }
    return debits === credits;
  }
}
