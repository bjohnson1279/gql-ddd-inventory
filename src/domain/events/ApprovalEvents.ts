import { DomainEvent } from './DomainEvent';

export class ApprovalRequestApprovedEvent implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(
    public readonly requestId: string,
    public readonly tenantId: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly payload: Record<string, any>
  ) {
    this.occurredAt = new Date();
  }
}

export class ApprovalRequestRejectedEvent implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(
    public readonly requestId: string,
    public readonly tenantId: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly payload: Record<string, any>
  ) {
    this.occurredAt = new Date();
  }
}
