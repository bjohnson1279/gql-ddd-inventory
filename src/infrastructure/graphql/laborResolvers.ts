import { PredictiveSchedulingEngine } from '../../domain/labor/LaborServices';

const engine = new PredictiveSchedulingEngine();

export const laborResolvers = {
  Query: {
    predictStaffing: (_: any, args: { targetDate: string, inboundVol: number, outboundVol: number, avgPicks: number }) => {
      return engine.generateStaffingRecommendation(
        new Date(args.targetDate),
        args.inboundVol,
        args.outboundVol,
        args.avgPicks,
        8.0
      );
    }
  }
};
