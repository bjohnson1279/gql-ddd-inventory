export type LotStatus = 'ACTIVE' | 'QUARANTINED' | 'RECALLED' | 'EXPIRED';

export class LotBatch {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly lotNumber: string,
    public readonly variantId: string,
    public status: LotStatus = 'ACTIVE',
    public readonly manufacturedDate?: Date,
    public readonly expirationDate?: Date,
    public readonly supplierId?: string,
    public quarantinedAt?: Date,
    public quarantineReason?: string,
    public recalledAt?: Date,
    public readonly createdAt: Date = new Date()
  ) {}

  public isAvailable(): boolean {
    if (this.status !== 'ACTIVE') {
      return false;
    }
    if (this.expirationDate && this.expirationDate.getTime() <= Date.now()) {
      return false;
    }
    return true;
  }

  public quarantine(reason: string): void {
    this.status = 'QUARANTINED';
    this.quarantinedAt = new Date();
    this.quarantineReason = reason;
  }

  public recall(reason: string): void {
    this.status = 'RECALLED';
    this.recalledAt = new Date();
    this.quarantineReason = reason;
  }

  public release(): void {
    this.status = 'ACTIVE';
    this.quarantinedAt = undefined;
    this.quarantineReason = undefined;
    this.recalledAt = undefined;
  }
}
