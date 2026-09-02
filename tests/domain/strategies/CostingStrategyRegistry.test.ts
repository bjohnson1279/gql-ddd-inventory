import { CostingStrategyRegistry } from '../../../src/domain/strategies/CostingStrategyRegistry';
import { CostingMethod } from '../../../src/domain/enums/AccountingEnums';
import { FifoCostingStrategy } from '../../../src/domain/strategies/FifoCostingStrategy';
import { LifoCostingStrategy } from '../../../src/domain/strategies/LifoCostingStrategy';
import { WeightedAverageCostingStrategy } from '../../../src/domain/strategies/WeightedAverageCostingStrategy';
import { FefoCostingStrategy } from '../../../src/domain/strategies/FefoCostingStrategy';

describe('CostingStrategyRegistry', () => {
  it('should return FifoCostingStrategy for FIFO method', () => {
    const strategy = CostingStrategyRegistry.get(CostingMethod.FIFO);
    expect(strategy).toBeInstanceOf(FifoCostingStrategy);
  });

  it('should return LifoCostingStrategy for LIFO method', () => {
    const strategy = CostingStrategyRegistry.get(CostingMethod.LIFO);
    expect(strategy).toBeInstanceOf(LifoCostingStrategy);
  });

  it('should return WeightedAverageCostingStrategy for WeightedAverageCost method', () => {
    const strategy = CostingStrategyRegistry.get(CostingMethod.WeightedAverageCost);
    expect(strategy).toBeInstanceOf(WeightedAverageCostingStrategy);
  });

  it('should return FefoCostingStrategy for FEFO method', () => {
    const strategy = CostingStrategyRegistry.get(CostingMethod.FEFO);
    expect(strategy).toBeInstanceOf(FefoCostingStrategy);
  });

  it('should throw an error for unsupported costing method', () => {
    expect(() => CostingStrategyRegistry.get('unsupported_method' as CostingMethod)).toThrow('Unsupported costing method: unsupported_method');
  });
});
