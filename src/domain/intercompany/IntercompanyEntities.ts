export enum TransferStatus {
  DRAFT = 'DRAFT',
  SHIPPED = 'SHIPPED',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED'
}

export enum PricingRuleType {
  COST_PLUS = 'COST_PLUS',
  MARKET_BASED = 'MARKET_BASED'
}

export interface LegalEntity {
  id: string;
  tenantId: string;
  name: string;
  currencyCode: string;
  taxIdentificationNumber: string;
}

export interface TransferPricingRule {
  sourceEntityId: string;
  destinationEntityId: string;
  ruleType: PricingRuleType;
  markupPercentage: number;
}

export class IntercompanyTransfer {
  constructor(
    public id: string,
    public tenantId: string,
    public sourceEntityId: string,
    public destinationEntityId: string,
    public sku: string,
    public quantity: number,
    public transferPriceCents: number,
    public status: TransferStatus,
    public tariffsCents: number = 0
  ) {}

  public ship(): void {
    if (this.status !== TransferStatus.DRAFT) {
      throw new Error("Can only ship DRAFT transfers");
    }
    this.status = TransferStatus.SHIPPED;
  }

  public receive(): void {
    if (this.status !== TransferStatus.SHIPPED) {
      throw new Error("Can only receive SHIPPED transfers");
    }
    this.status = TransferStatus.RECEIVED;
  }

  public complete(): void {
    if (this.status !== TransferStatus.RECEIVED) {
      throw new Error("Can only complete RECEIVED transfers");
    }
    this.status = TransferStatus.COMPLETED;
  }
}

export interface IntercompanyJournalEntry {
  transferId: string;
  entityId: string;
  debitAccount: string;
  creditAccount: string;
  amountCents: number;
  isElimination: boolean;
}
