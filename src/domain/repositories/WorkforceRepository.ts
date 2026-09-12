import { WarehouseOperator } from '../entities/WarehouseOperator';
import { LaborShift } from '../entities/LaborShift';
import { TaskPerformance } from '../entities/TaskPerformance';

export interface WorkforceRepository {
  getOperatorByUserId(userId: string): Promise<WarehouseOperator | null>;
  createOperator(operator: WarehouseOperator): Promise<void>;
  updateOperator(operator: WarehouseOperator): Promise<void>;

  saveLaborShift(shift: LaborShift): Promise<void>;
  getShiftsForOperator(operatorId: string, start: Date, end: Date): Promise<LaborShift[]>;

  saveTaskPerformance(performance: TaskPerformance): Promise<void>;
  getLeaderboard(tenantId: string, limit: number): Promise<WarehouseOperator[]>;
  getAllOperators(tenantId: string): Promise<WarehouseOperator[]>;
}
