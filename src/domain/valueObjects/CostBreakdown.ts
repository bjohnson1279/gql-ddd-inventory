export class CostBreakdown {
  constructor(
    public readonly quantity: number,
    public readonly totalCostCents: number
  ) {}

  get averageUnitCostCents(): number {
    return this.quantity > 0 ? Math.round(this.totalCostCents / this.quantity) : 0;
  }
}
