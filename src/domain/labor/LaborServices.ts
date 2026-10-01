import { v4 as uuidv4 } from 'uuid';
import { OperatorPerformanceKpi, PredictiveStaffingSchedule } from './LaborEntities';

export class OperatorPerformanceService {
  public calculateDailyKpi(
    operatorId: string,
    targetDate: Date,
    totalPicks: number,
    hoursWorked: number,
    accurateCounts: number,
    totalCounts: number,
    distanceMeters: number
  ): OperatorPerformanceKpi {
    
    const picksPerHour = hoursWorked > 0 ? totalPicks / hoursWorked : 0.0;
    const accuracy = totalCounts > 0 ? (accurateCounts / totalCounts) * 100.0 : 100.0;
    
    return {
      operatorId,
      targetDate,
      actualPicksPerHour: picksPerHour,
      cycleCountAccuracyPercent: accuracy,
      traversalDistanceMeters: distanceMeters
    };
  }
}

export class PredictiveSchedulingEngine {
  public generateStaffingRecommendation(
    targetDate: Date,
    projectedInboundVolume: number,
    projectedOutboundVolume: number,
    averageOperatorTargetPicks: number,
    shiftDurationHours: number = 8.0
  ): PredictiveStaffingSchedule {
    
    const totalVolume = projectedInboundVolume + projectedOutboundVolume;
    const picksPerShift = averageOperatorTargetPicks * shiftDurationHours;
    
    let recommendedHeadcount = 0;
    if (picksPerShift > 0) {
      recommendedHeadcount = Math.ceil(totalVolume / picksPerShift);
    }
    
    return new PredictiveStaffingSchedule(
      uuidv4(),
      targetDate,
      projectedInboundVolume,
      projectedOutboundVolume,
      recommendedHeadcount
    );
  }
}
