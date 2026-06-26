import { IJournalRepository } from '../repositories/IJournalRepository';
import { JournalEntry } from '../entities/JournalEntry';
import { JournalEntryId } from '../valueObjects/JournalEntryId';
import { TenantId } from '../valueObjects/TenantId';
import { AccountCode } from '../valueObjects/AccountCode';
import { DebitCredit, AccountingMethod, AccountCategory } from '../enums/AccountingEnums';
import crypto from 'crypto';

export class AccountingJournalService {
  constructor(private readonly journalRepo: IJournalRepository) {}

  public async onStockReturned(
    variantId: string,
    totalCostCents: number,
    referenceId: string,
    date: Date,
    tenantId: string
  ): Promise<JournalEntry> {
    return this.createEntry(
      tenantId,
      date,
      `Inventory return receipt — variant ${variantId} — reference ${referenceId}`,
      referenceId,
      AccountingMethod.Accrual,
      [
        [AccountCode.inventory(), totalCostCents, DebitCredit.Debit, `Returned stock`],
        [AccountCode.costOfGoodsSold(), totalCostCents, DebitCredit.Credit, `COGS reversal`],
      ]
    );
  }

  public async onInventoryWriteOff(
    referenceId: string,
    totalCostCents: number,
    date: Date,
    tenantId: string
  ): Promise<JournalEntry> {
    return this.createEntry(
      tenantId,
      date,
      `Inventory Write-Off — Ref ${referenceId}`,
      referenceId,
      AccountingMethod.Accrual,
      [
        [
          AccountCode.inventoryWriteOffExpense(),
          totalCostCents,
          DebitCredit.Debit,
          `Inventory write-off`,
        ],
        [AccountCode.inventory(), totalCostCents, DebitCredit.Credit, `Inventory reduction`],
      ]
    );
  }

  public async onReturnToVendor(
    referenceId: string,
    totalCostCents: number,
    date: Date,
    tenantId: string
  ): Promise<JournalEntry> {
    return this.createEntry(
      tenantId,
      date,
      `Return to Vendor — Ref ${referenceId}`,
      referenceId,
      AccountingMethod.Accrual,
      [
        [
          AccountCode.accountsPayable(),
          totalCostCents,
          DebitCredit.Debit,
          `AP cleared — return to vendor`,
        ],
        [AccountCode.inventory(), totalCostCents, DebitCredit.Credit, `Inventory reduction`],
      ]
    );
  }

  public async onShippingLabelPurchased(
    tenantId: string,
    shipmentId: string,
    rateCents: number,
    carrier: string,
    trackingNumber: string,
    date: Date
  ): Promise<JournalEntry> {
    const freightExpense = new AccountCode('5400', 'Shipping & Freight Expense', AccountCategory.Expense);
    const freightLiability = new AccountCode('2100', 'Accrued Shipping Liabilities', AccountCategory.Liability);

    return this.createEntry(
      tenantId,
      date,
      `Shipping carrier label purchased: ${carrier} ${trackingNumber}`,
      shipmentId,
      AccountingMethod.Accrual,
      [
        [freightExpense, rateCents, DebitCredit.Debit, 'Carrier shipping expense'],
        [freightLiability, rateCents, DebitCredit.Credit, 'Accrued carrier liabilities'],
      ]
    );
  }

  private async createEntry(
    tenantId: string,
    date: Date,
    description: string,
    referenceId: string | null,
    method: AccountingMethod,
    lines: [AccountCode, number, DebitCredit, string][]
  ): Promise<JournalEntry> {
    const entry = new JournalEntry(
      new JournalEntryId(crypto.randomUUID()),
      new TenantId(tenantId),
      date,
      description,
      method,
      referenceId || undefined
    );

    for (const [account, amount, type, memo] of lines) {
      entry.addLine(account, amount, type, memo);
    }

    if (!entry.isBalanced()) {
      throw new Error('Journal entry is unbalanced. Debits must equal Credits.');
    }

    await this.journalRepo.save(entry);
    return entry;
  }
}
