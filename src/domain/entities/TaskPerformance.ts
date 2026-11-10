import { TaskPerformanceId } from '../valueObjects/TaskPerformanceId';

export class TaskPerformance {
  public readonly id: TaskPerformanceId;

  constructor(
    id: TaskPerformanceId | string,
    public readonly operatorId: string,
    public readonly tenantId: string,
    public readonly taskType: string,
    public readonly locationId: string,
    public readonly traversalDistanceMeters: number,
    public readonly durationSeconds: number,
    public readonly accuracyScore: number,
    public readonly occurredAt: Date
  ) {
    this.id = typeof id === 'string' ? new TaskPerformanceId(id) : id;
  }
}
