import { IJournalRepository } from '../../domain/repositories/IJournalRepository';
import { JournalEntry } from '../../domain/entities/JournalEntry';
import { JournalEntryId } from '../../domain/valueObjects/JournalEntryId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { AccountCode } from '../../domain/valueObjects/AccountCode';
import { AccountingMethod, DebitCredit } from '../../domain/enums/AccountingEnums';
import { DomainEventDispatcher } from '../services/DomainEventDispatcher';
import { JournalEntryCreatedEvent } from '../../domain/events/JournalEntryCreatedEvent';

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
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly eventDispatcher?: DomainEventDispatcher
  ) {}

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

    const eventLines = input.lines.map(line => ({
      accountCode: line.accountCode,
      amountCents: line.amountCents,
      type: line.type as 'debit' | 'credit',
      memo: line.memo || ''
    }));

    if (this.eventDispatcher) {
      this.eventDispatcher.dispatch([
        new JournalEntryCreatedEvent(
          input.id,
          input.tenantId,
          input.description,
          input.date,
          input.method,
          input.referenceId || null,
          eventLines.map(el => ({
            ...el,
            accountName: AccountCode.fromCode(el.accountCode).name
          }))
        )
      ]);
    }

    return true;
  }
}


export class GetJournalEntriesUseCase {
  constructor(private readonly journalRepo: IJournalRepository) {}

  async execute(tenantId: string): Promise<JournalEntry[]> {
    return await this.journalRepo.findAllByTenant(new TenantId(tenantId));
  }
}
