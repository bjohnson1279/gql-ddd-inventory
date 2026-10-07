import { CycleCountPlanModel } from '@prisma/client';
import { CycleCountScheduler } from '../../../src/domain/cycleCount/CycleCountScheduler';

describe('CycleCountScheduler', () => {
  let scheduler: CycleCountScheduler;

  beforeEach(() => {
    scheduler = new CycleCountScheduler();
  });

  it('should generate an audit when daysSinceLastCount is greater than or equal to frequencyDays', () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    const activePlans: CycleCountPlanModel[] = [
      {
        id: 'plan-1',
        tenantId: 'tenant-1',
        name: 'Weekly Zone A',
        abcClassification: 'A',
        frequencyDays: 7,
        zone: 'Zone-A',
        isActive: true,
        createdAt: tenDaysAgo,
      },
    ];

    const lastCountDates: Record<string, Date> = {
      'plan-1': tenDaysAgo,
    };

    const audits = scheduler.generateAudits(activePlans, lastCountDates);

    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      tenantId: 'tenant-1',
      name: 'Audit based on Weekly Zone A',
      status: 'PENDING',
      abcClass: 'A',
      zone: 'Zone-A',
      isBlindCount: true,
    });
    expect(audits[0].id).toBeDefined();
    expect(audits[0].createdAt).toBeInstanceOf(Date);
  });

  it('should generate an audit when plan has no previous count date (Infinity days since last count)', () => {
    const activePlans: CycleCountPlanModel[] = [
      {
        id: 'plan-2',
        tenantId: 'tenant-1',
        name: 'Monthly Zone B',
        abcClassification: 'B',
        frequencyDays: 30,
        zone: null,
        isActive: true,
        createdAt: new Date(),
      },
    ];

    const lastCountDates: Record<string, Date> = {};

    const audits = scheduler.generateAudits(activePlans, lastCountDates);

    expect(audits).toHaveLength(1);
    expect(audits[0].zone).toBeUndefined();
    expect(audits[0].name).toBe('Audit based on Monthly Zone B');
  });

  it('should not generate an audit when daysSinceLastCount is less than frequencyDays', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const activePlans: CycleCountPlanModel[] = [
      {
        id: 'plan-3',
        tenantId: 'tenant-1',
        name: 'Weekly Zone C',
        abcClassification: 'C',
        frequencyDays: 7,
        zone: 'Zone-C',
        isActive: true,
        createdAt: twoDaysAgo,
      },
    ];

    const lastCountDates: Record<string, Date> = {
      'plan-3': twoDaysAgo,
    };

    const audits = scheduler.generateAudits(activePlans, lastCountDates);

    expect(audits).toHaveLength(0);
  });

  it('should handle multiple plans and generate audits only for eligible ones', () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const activePlans: CycleCountPlanModel[] = [
      {
        id: 'plan-due',
        tenantId: 'tenant-1',
        name: 'Due Plan',
        abcClassification: 'A',
        frequencyDays: 5,
        zone: 'Zone-A',
        isActive: true,
        createdAt: tenDaysAgo,
      },
      {
        id: 'plan-not-due',
        tenantId: 'tenant-1',
        name: 'Not Due Plan',
        abcClassification: 'B',
        frequencyDays: 5,
        zone: 'Zone-B',
        isActive: true,
        createdAt: twoDaysAgo,
      },
    ];

    const lastCountDates: Record<string, Date> = {
      'plan-due': tenDaysAgo,
      'plan-not-due': twoDaysAgo,
    };

    const audits = scheduler.generateAudits(activePlans, lastCountDates);

    expect(audits).toHaveLength(1);
    expect(audits[0].name).toBe('Audit based on Due Plan');
  });

  it('should return empty array if activePlans is empty', () => {
    const audits = scheduler.generateAudits([], {});
    expect(audits).toEqual([]);
  });
});
