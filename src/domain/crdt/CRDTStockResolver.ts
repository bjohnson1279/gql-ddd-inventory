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
    let totalInc = 0;
    for (const key in state.increments) {
      totalInc += state.increments[key];
    }
    let totalDec = 0;
    for (const key in state.decrements) {
      totalDec += state.decrements[key];
    }
    return Math.max(0, totalInc - totalDec);
  }

  public static merge(stateA: PNCounterState, stateB: PNCounterState): PNCounterState {
    const mergedIncrements: Record<string, number> = {};
    const mergedDecrements: Record<string, number> = {};

    for (const nodeId in stateA.increments) {
      mergedIncrements[nodeId] = Math.max(stateA.increments[nodeId] || 0, stateB.increments[nodeId] || 0);
    }
    for (const nodeId in stateB.increments) {
      if (!(nodeId in mergedIncrements)) {
        mergedIncrements[nodeId] = Math.max(stateA.increments[nodeId] || 0, stateB.increments[nodeId] || 0);
      }
    }

    for (const nodeId in stateA.decrements) {
      mergedDecrements[nodeId] = Math.max(stateA.decrements[nodeId] || 0, stateB.decrements[nodeId] || 0);
    }
    for (const nodeId in stateB.decrements) {
      if (!(nodeId in mergedDecrements)) {
        mergedDecrements[nodeId] = Math.max(stateA.decrements[nodeId] || 0, stateB.decrements[nodeId] || 0);
      }
    }

    return {
      sku: stateA.sku,
      increments: mergedIncrements,
      decrements: mergedDecrements,
    };
  }
}
