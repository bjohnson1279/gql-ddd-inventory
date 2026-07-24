export interface VectorClock {
  nodeId: string;
  counter: number;
  timestamp: number;
}

export interface PNCounterState {
  sku: string;
  increments: Record<string, number>; // nodeId -> count
  decrements: Record<string, number>; // nodeId -> count
}

export class CRDTStockResolver {
  public static createStockCounter(sku: string): PNCounterState {
    return {
      sku,
      increments: {},
      decrements: {},
    };
  }

  public static increment(state: PNCounterState, nodeId: string, amount: number): PNCounterState {
    const newInc = { ...state.increments, [nodeId]: (state.increments[nodeId] || 0) + amount };
    return { ...state, increments: newInc };
  }

  public static decrement(state: PNCounterState, nodeId: string, amount: number): PNCounterState {
    const newDec = { ...state.decrements, [nodeId]: (state.decrements[nodeId] || 0) + amount };
    return { ...state, decrements: newDec };
  }

  public static getValue(state: PNCounterState): number {
    const totalInc = Object.values(state.increments).reduce((sum, val) => sum + val, 0);
    const totalDec = Object.values(state.decrements).reduce((sum, val) => sum + val, 0);
    return Math.max(0, totalInc - totalDec);
  }

  public static merge(stateA: PNCounterState, stateB: PNCounterState): PNCounterState {
    const mergedIncrements: Record<string, number> = {};
    const mergedDecrements: Record<string, number> = {};

    const allIncNodes = new Set([...Object.keys(stateA.increments), ...Object.keys(stateB.increments)]);
    allIncNodes.forEach((nodeId) => {
      mergedIncrements[nodeId] = Math.max(stateA.increments[nodeId] || 0, stateB.increments[nodeId] || 0);
    });

    const allDecNodes = new Set([...Object.keys(stateA.decrements), ...Object.keys(stateB.decrements)]);
    allDecNodes.forEach((nodeId) => {
      mergedDecrements[nodeId] = Math.max(stateA.decrements[nodeId] || 0, stateB.decrements[nodeId] || 0);
    });

    return {
      sku: stateA.sku,
      increments: mergedIncrements,
      decrements: mergedDecrements,
    };
  }
}
