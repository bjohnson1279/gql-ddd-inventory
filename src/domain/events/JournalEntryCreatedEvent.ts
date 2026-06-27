import { DomainEvent } from './DomainEvent';

export class JournalEntryCreatedEvent implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly description: string,
    public readonly date: string,
    public readonly method: string,
    public readonly referenceId: string | null,
    public readonly lines: Array<{
      accountCode: string;
      accountName: string;
      amountCents: number;
      type: 'debit' | 'credit';
      memo: string;
    }>
  ) {
    this.occurredAt = new Date();
  }
}
