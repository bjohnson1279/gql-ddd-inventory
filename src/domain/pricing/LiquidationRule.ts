export class LiquidationRule {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly daysToExpiration: number,
    public readonly markdownPercentage: number,
    public readonly isActive: boolean,
    public readonly department?: string,
    public readonly sku?: string
  ) {}
}
