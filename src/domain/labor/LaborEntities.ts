export enum ScheduleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED'
}

export interface OperatorProfile {
  operatorId: string;
  tenantId: string;
  targetPicksPerHour: number;
  maxConsecutiveHours: number;
  certifications: string[];
}

export interface OperatorPerformanceKpi {
  operatorId: string;
  targetDate: Date;
  actualPicksPerHour: number;
  cycleCountAccuracyPercent: number;
  traversalDistanceMeters: number;
}

export class PredictiveStaffingSchedule {
  constructor(
    public scheduleId: string,
    public targetDate: Date,
    public projectedInboundVolume: number,
    public projectedOutboundVolume: number,
    public recommendedHeadcount: number,
    public status: ScheduleStatus = ScheduleStatus.DRAFT
  ) {}

  public publish(): void {
    if (this.status !== ScheduleStatus.DRAFT) {
      throw new Error("Can only publish DRAFT schedules");
    }
    this.status = ScheduleStatus.PUBLISHED;
  }
}
