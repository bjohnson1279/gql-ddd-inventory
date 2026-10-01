import { DynamicPricingEngine, YieldCalculationService } from '../../domain/yield_management/YieldServices';

const calc = new YieldCalculationService();
const engine = new DynamicPricingEngine(calc);

export const yieldResolvers = {
  Query: {
    recommendMarkdown: (_: any, args: { metrics: any, profile: any }) => {
      return engine.generateMarkdown(args.metrics, args.profile);
    }
  }
};
