export class MarkdownEvent {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly variantId: string,
    public readonly originalPriceCents: number,
    public readonly newPriceCents: number,
    public readonly reason: string,
    public readonly createdAt: Date,
    public readonly ruleId?: string
  ) {}
}
