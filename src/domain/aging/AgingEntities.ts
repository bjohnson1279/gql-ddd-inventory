export enum AgingBucket {
  DAYS_0_30 = '0_30_DAYS',
  DAYS_31_60 = '31_60_DAYS',
  DAYS_61_90 = '61_90_DAYS',
  DAYS_91_180 = '91_180_DAYS',
  OVER_180_DAYS = 'OVER_180_DAYS'
}

export enum RecommendedAction {
  NONE = 'NONE',
  MARKDOWN = 'MARKDOWN',
  LIQUIDATE = 'LIQUIDATE',
  DONATE = 'DONATE',
  SCRAP = 'SCRAP'
}

export interface DeadStockAnalysis {
  sku: string;
  locationId: string;
  tenantId: string;
  currentQuantity: number;
  daysSinceLastMovement: number;
  isDeadStock: boolean;
  agingBucket: AgingBucket;
  lockedCapitalCents: number;
  recommendedAction: RecommendedAction;
}
