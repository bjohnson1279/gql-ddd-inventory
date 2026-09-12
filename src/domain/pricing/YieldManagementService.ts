import { LiquidationRule } from './LiquidationRule';
import { MarkdownEvent } from './MarkdownEvent';

export interface YieldManagementRepository {
  getActiveRules(tenantId: string): Promise<LiquidationRule[]>;
  saveMarkdownEvent(event: MarkdownEvent): Promise<void>;
  updateVariantPrice(tenantId: string, variantId: string, newPriceCents: number): Promise<void>;
  // Fetch expiring lots
  getLotsExpiringWithin(tenantId: string, days: number): Promise<any[]>;
}

export class YieldManagementService {
  constructor(private readonly repo: YieldManagementRepository) {}

  async runYieldOptimization(tenantId: string): Promise<MarkdownEvent[]> {
    const rules = await this.repo.getActiveRules(tenantId);
    if (rules.length === 0) return [];

    // Find the max days_to_expiration among rules to know how far ahead to look
    const maxDays = Math.max(...rules.map(r => r.daysToExpiration));
    const expiringLots = await this.repo.getLotsExpiringWithin(tenantId, maxDays);

    // Call python sidecar to optimize yield
    // Mocking sidecar response for MVP
    const events: MarkdownEvent[] = [];
    
    for (const lot of expiringLots) {
      // Stub: in a real implementation, we send these to the sidecar via HTTP
      const appliedRule = rules[0]; // just picking the first for the stub
      
      const newPrice = Math.floor(lot.currentPriceCents * (1 - appliedRule.markdownPercentage / 100));
      
      const event = new MarkdownEvent(
        crypto.randomUUID(),
        tenantId,
        lot.variantId,
        lot.currentPriceCents,
        newPrice,
        `Yield Optimization: applied rule ${appliedRule.id}`,
        new Date(),
        appliedRule.id
      );
      
      events.push(event);
      
      await this.repo.updateVariantPrice(tenantId, lot.variantId, newPrice);
      await this.repo.saveMarkdownEvent(event);
    }

    return events;
  }
}
