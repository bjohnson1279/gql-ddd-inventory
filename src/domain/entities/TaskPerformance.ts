export class TaskPerformance {
  constructor(
    public readonly id: string,
    public readonly operatorId: string,
    public readonly tenantId: string,
    public readonly taskType: string,
    public readonly locationId: string,
    public readonly traversalDistanceMeters: number,
    public readonly durationSeconds: number,
    public readonly accuracyScore: number,
    public readonly occurredAt: Date
  ) {}
}
