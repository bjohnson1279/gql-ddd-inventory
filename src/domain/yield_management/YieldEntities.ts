export enum MarkdownStatus {
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  PUSHED_TO_CHANNELS = 'PUSHED_TO_CHANNELS'
}

export interface LiquidationProfile {
  sku: string;
  basePriceCents: number;
  holdingCostPerDayCents: number;
  minFloorPriceCents: number;
}

export interface InventoryYieldMetrics {
  sku: string;
  daysInInventory: number;
  daysUntilExpiration: number | null;
  historicalDailyDemand: number;
  currentStockQuantity: number;
}

export class PriceMarkdownRecommendation {
  constructor(
    public id: string,
    public sku: string,
    public recommendedPriceCents: number,
    public reasoning: string,
    public status: MarkdownStatus = MarkdownStatus.PROPOSED
  ) {}

  public approve(): void {
    if (this.status !== MarkdownStatus.PROPOSED) {
      throw new Error("Can only approve PROPOSED markdowns");
    }
    this.status = MarkdownStatus.APPROVED;
  }

  public pushToChannels(): void {
    if (this.status !== MarkdownStatus.APPROVED) {
      throw new Error("Can only push APPROVED markdowns");
    }
    this.status = MarkdownStatus.PUSHED_TO_CHANNELS;
  }
}
