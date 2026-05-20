import { AccountCategory } from '../enums/AccountingEnums';

export class AccountCode {
  constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly category: AccountCategory
  ) {}

  static cash(): AccountCode {
    return new AccountCode('1000', 'Cash', AccountCategory.Asset);
  }

  static accountsReceivable(): AccountCode {
    return new AccountCode('1100', 'Accounts Receivable', AccountCategory.Asset);
  }

  static inventory(): AccountCode {
    return new AccountCode('1200', 'Inventory', AccountCategory.Asset);
  }

  static accountsPayable(): AccountCode {
    return new AccountCode('2000', 'Accounts Payable', AccountCategory.Liability);
  }

  static salesRevenue(): AccountCode {
    return new AccountCode('4000', 'Sales Revenue', AccountCategory.Revenue);
  }

  static costOfGoodsSold(): AccountCode {
    return new AccountCode('5000', 'Cost of Goods Sold', AccountCategory.Expense);
  }
}
