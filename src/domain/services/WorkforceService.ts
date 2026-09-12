import { WorkforceRepository } from '../repositories/WorkforceRepository';
import { WarehouseOperator } from '../entities/WarehouseOperator';
import { LaborShift } from '../entities/LaborShift';
import { TaskPerformance } from '../entities/TaskPerformance';

export class WorkforceService {
  constructor(private readonly workforceRepo: WorkforceRepository) {}

  async getOrCreateOperator(userId: string, tenantId: string): Promise<WarehouseOperator> {
    let operator = await this.workforceRepo.getOperatorByUserId(userId);
    if (!operator) {
      operator = new WarehouseOperator(
        crypto.randomUUID(),
        userId,
        tenantId,
        0.0,
        0.0,
        100.0,
        new Date(),
        new Date()
      );
      await this.workforceRepo.createOperator(operator);
    }
    return operator;
  }

  async logTaskPerformance(
    operatorId: string,
    tenantId: string,
    taskType: string,
    locationId: string,
    durationSeconds: number,
    traversalDistanceMeters: number = 0
  ): Promise<void> {
    const performance = new TaskPerformance(
      crypto.randomUUID(),
      operatorId,
      tenantId,
      taskType,
      locationId,
      traversalDistanceMeters,
      durationSeconds,
      100.0,
      new Date()
    );
    await this.workforceRepo.saveTaskPerformance(performance);

    // In a real implementation, we would fetch the operator, update average stats, and save it.
  }
}
