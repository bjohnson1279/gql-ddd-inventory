import { PrismaClient } from '@prisma/client';
import { CycleCount } from '../../domain/cycleCount/CycleCount';
import { CycleCountPlanModel } from '@prisma/client';

export class CycleCountPrismaRepository {
  constructor(private prisma: PrismaClient) {}

  public async savePlan(plan: Omit<CycleCountPlanModel, 'createdAt' | 'id'>): Promise<CycleCountPlanModel> {
    return this.prisma.cycleCountPlanModel.create({
      data: {
        tenantId: plan.tenantId,
        name: plan.name,
        abcClassification: plan.abcClassification,
        frequencyDays: plan.frequencyDays,
        zone: plan.zone,
        isActive: plan.isActive,
      }
    });
  }

  public async getActivePlans(tenantId: string): Promise<CycleCountPlanModel[]> {
    return this.prisma.cycleCountPlanModel.findMany({
      where: {
        tenantId,
        isActive: true,
      }
    });
  }

  public async deactivatePlan(id: string): Promise<void> {
    await this.prisma.cycleCountPlanModel.update({
      where: { id },
      data: { isActive: false }
    });
  }

  public async saveRecord(record: CycleCount): Promise<void> {
    await this.prisma.cycleCountRecordModel.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        name: record.name,
        status: record.status,
        abcClassification: record.abcClass || 'C',
        zone: record.zone,
        isBlindCount: record.isBlindCount,
        createdAt: record.createdAt,
      }
    });
  }
}
