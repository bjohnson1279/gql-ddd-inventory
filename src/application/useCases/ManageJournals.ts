import { IJournalRepository } from '../../domain/repositories/IJournalRepository';
import { JournalEntry } from '../../domain/entities/JournalEntry';
import { JournalEntryId } from '../../domain/valueObjects/JournalEntryId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { AccountCode } from '../../domain/valueObjects/AccountCode';
import { AccountingMethod, DebitCredit } from '../../domain/enums/AccountingEnums';

export interface JournalLineInput {
  accountCode: string;
  amountCents: number;
  type: DebitCredit;
  memo?: string;
}

export interface CreateJournalEntryInput {
  id: string;
  tenantId: string;
  date: string;
  description: string;
  method: AccountingMethod;
  referenceId?: string;
  lines: JournalLineInput[];
}

export class CreateJournalEntryUseCase {
  constructor(private readonly journalRepo: IJournalRepository) {}

  async execute(input: CreateJournalEntryInput): Promise<boolean> {
    const entry = new JournalEntry(
      new JournalEntryId(input.id),
      new TenantId(input.tenantId),
      new Date(input.date),
      input.description,
      input.method,
      input.referenceId
    );

    for (const line of input.lines) {
      entry.addLine(
        AccountCode.fromCode(line.accountCode),
        line.amountCents,
        line.type,
        line.memo
      );
    }

    if (!entry.isBalanced()) {
      throw new Error('Journal entry is unbalanced. Debits must equal Credits.');
    }

    await this.journalRepo.save(entry);
    return true;
  }
}

export class GetJournalEntriesUseCase {
  constructor(private readonly journalRepo: IJournalRepository) {}

  async execute(tenantId: string): Promise<JournalEntry[]> {
    return await this.journalRepo.findAllByTenant(new TenantId(tenantId));
  }
}
