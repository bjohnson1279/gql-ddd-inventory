import { AccountCode } from '../valueObjects/AccountCode';
import { DebitCredit } from '../enums/AccountingEnums';

export class JournalLine {
  constructor(
    public readonly account: AccountCode,
    public readonly amountCents: number,
    public readonly type: DebitCredit,
    public readonly memo: string = ''
  ) {
    if (amountCents <= 0) {
      throw new Error('Journal line amount must be positive.');
    }
  }
}
