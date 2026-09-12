export class WarehouseOperator {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly averagePicksPerHour: number,
    public readonly totalDistanceWalkedM: number,
    public readonly accuracyScore: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
