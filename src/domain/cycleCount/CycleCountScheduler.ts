import { randomUUID as uuidv4 } from 'crypto';
import { CycleCount } from './CycleCount';
import { CycleCountPlan } from './CycleCountPlan';

export class CycleCountScheduler {
  public generateAudits(activePlans: CycleCountPlan[], lastCountDates: Record<string, Date>): CycleCount[] {
    const generated: CycleCount[] = [];
    const now = new Date();

    for (const plan of activePlans) {
      const planKey = plan.id;
      const lastCount = lastCountDates[planKey];
      
      const daysSinceLastCount = lastCount 
        ? (now.getTime() - lastCount.getTime()) / (1000 * 3600 * 24)
        : Infinity;

      if (daysSinceLastCount >= plan.frequencyDays) {
        generated.push({
          id: uuidv4(),
          tenantId: plan.tenantId,
          name: `Audit based on ${plan.name}`,
          status: 'PENDING',
          abcClass: plan.abcClassification,
          zone: plan.zone || undefined,
          isBlindCount: true,
          createdAt: now,
        });
      }
    }

    return generated;
  }
}

