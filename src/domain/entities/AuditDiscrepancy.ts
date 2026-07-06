export class AuditDiscrepancy {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly type: string, // 'SHOPIFY_STOCK_MISMATCH' | 'ACCOUNTING_JOURNAL_MISSING'
    public readonly referenceId: string, // SKU or local journal UUID
    public readonly externalRefId: string | null,
    public readonly description: string,
    public status: string = 'OPEN', // 'OPEN' | 'RESOLVED'
    public readonly occurredAt: Date = new Date(),
    public resolvedAt: Date | null = null,
    public resolutionNotes: string | null = null
  ) {}

  public resolve(notes: string): void {
    this.status = 'RESOLVED';
    this.resolvedAt = new Date();
    this.resolutionNotes = notes;
  }
}
