export class LaborShift {
  constructor(
    public readonly id: string,
    public readonly operatorId: string,
    public readonly tenantId: string,
    public readonly startTime: Date,
    public readonly endTime: Date,
    public readonly status: string,
    public readonly predictedDemand: number,
    public readonly actualCompleted: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
