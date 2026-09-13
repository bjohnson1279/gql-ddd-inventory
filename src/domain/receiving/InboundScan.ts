export type ScanStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export class Dimensions {
  constructor(
    public readonly length: number,
    public readonly width: number,
    public readonly height: number
  ) {}
}

export class InboundScan {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly purchaseOrderId: string | null,
    public readonly imageUrl: string,
    public readonly dimensions: Dimensions,
    public readonly anomalyScore: number,
    public readonly hasDamage: boolean,
    public status: ScanStatus,
    public readonly ocrText: string | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  approve(): void {
    if (this.status !== 'PENDING') {
      throw new Error(`Cannot approve scan in status ${this.status}`);
    }
    this.status = 'APPROVED';
  }

  reject(): void {
    if (this.status !== 'PENDING') {
      throw new Error(`Cannot reject scan in status ${this.status}`);
    }
    this.status = 'REJECTED';
  }
}
