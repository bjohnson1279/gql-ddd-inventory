import { CostingMethod } from "../enums/AccountingEnums";
import { ICostingStrategy } from "./ICostingStrategy";
import { FifoCostingStrategy } from "./FifoCostingStrategy";
import { LifoCostingStrategy } from "./LifoCostingStrategy";
import { WeightedAverageCostingStrategy } from "./WeightedAverageCostingStrategy";
import { FefoCostingStrategy } from "./FefoCostingStrategy";

export class CostingStrategyRegistry {
  private static strategies: Map<CostingMethod, ICostingStrategy> = new Map([
    [CostingMethod.FIFO, new FifoCostingStrategy()],
    [CostingMethod.LIFO, new LifoCostingStrategy()],
    [CostingMethod.WeightedAverageCost, new WeightedAverageCostingStrategy()],
    [CostingMethod.FEFO, new FefoCostingStrategy()],
  ]);

  public static get(method: CostingMethod): ICostingStrategy {
    const strategy = this.strategies.get(method);
    if (!strategy) {
      throw new Error(`Unsupported costing method: ${method}`);
    }
    return strategy;
  }
}
