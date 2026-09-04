import { CRDTStockResolver, PNCounterState } from '../../../src/domain/crdt/CRDTStockResolver';

describe('CRDTStockResolver', () => {
  const SKU = 'TEST-SKU';

  describe('createStockCounter', () => {
    it('creates an empty counter', () => {
      const counter = CRDTStockResolver.createStockCounter(SKU);
      expect(counter.sku).toBe(SKU);
      expect(counter.increments).toEqual({});
      expect(counter.decrements).toEqual({});
    });
  });

  describe('increment', () => {
    it('increments for a given node', () => {
      const counter = CRDTStockResolver.createStockCounter(SKU);
      const inc1 = CRDTStockResolver.increment(counter, 'nodeA', 5);
      expect(inc1.increments['nodeA']).toBe(5);

      const inc2 = CRDTStockResolver.increment(inc1, 'nodeA', 3);
      expect(inc2.increments['nodeA']).toBe(8);

      const inc3 = CRDTStockResolver.increment(inc2, 'nodeB', 10);
      expect(inc3.increments['nodeB']).toBe(10);
    });
  });

  describe('decrement', () => {
    it('decrements for a given node', () => {
      const counter = CRDTStockResolver.createStockCounter(SKU);
      const dec1 = CRDTStockResolver.decrement(counter, 'nodeA', 2);
      expect(dec1.decrements['nodeA']).toBe(2);

      const dec2 = CRDTStockResolver.decrement(dec1, 'nodeA', 3);
      expect(dec2.decrements['nodeA']).toBe(5);

      const dec3 = CRDTStockResolver.decrement(dec2, 'nodeB', 1);
      expect(dec3.decrements['nodeB']).toBe(1);
    });
  });

  describe('getValue', () => {
    it('returns the correct value based on increments and decrements', () => {
      let counter = CRDTStockResolver.createStockCounter(SKU);
      counter = CRDTStockResolver.increment(counter, 'nodeA', 10);
      counter = CRDTStockResolver.increment(counter, 'nodeB', 5);
      counter = CRDTStockResolver.decrement(counter, 'nodeA', 2);
      counter = CRDTStockResolver.decrement(counter, 'nodeC', 3);

      expect(CRDTStockResolver.getValue(counter)).toBe(10);
    });

    it('never returns a negative value (floors at 0)', () => {
      let counter = CRDTStockResolver.createStockCounter(SKU);
      counter = CRDTStockResolver.decrement(counter, 'nodeA', 5);

      expect(CRDTStockResolver.getValue(counter)).toBe(0);
    });
  });

  describe('merge', () => {
    it('merges two counters correctly by taking the max of increments and decrements', () => {
      let stateA = CRDTStockResolver.createStockCounter(SKU);
      stateA = CRDTStockResolver.increment(stateA, 'nodeA', 10);
      stateA = CRDTStockResolver.increment(stateA, 'nodeB', 2);
      stateA = CRDTStockResolver.decrement(stateA, 'nodeA', 5);
      stateA = CRDTStockResolver.decrement(stateA, 'nodeC', 1);

      let stateB = CRDTStockResolver.createStockCounter(SKU);
      stateB = CRDTStockResolver.increment(stateB, 'nodeA', 8); // Less than stateA
      stateB = CRDTStockResolver.increment(stateB, 'nodeB', 5); // Greater than stateA
      stateB = CRDTStockResolver.increment(stateB, 'nodeD', 7); // Only in stateB
      stateB = CRDTStockResolver.decrement(stateB, 'nodeC', 4); // Greater than stateA
      stateB = CRDTStockResolver.decrement(stateB, 'nodeE', 2); // Only in stateB

      const merged = CRDTStockResolver.merge(stateA, stateB);

      expect(merged.increments['nodeA']).toBe(10);
      expect(merged.increments['nodeB']).toBe(5);
      expect(merged.increments['nodeD']).toBe(7);
      expect(merged.increments['nodeC']).toBeUndefined(); // No increment for C

      expect(merged.decrements['nodeA']).toBe(5);
      expect(merged.decrements['nodeC']).toBe(4);
      expect(merged.decrements['nodeE']).toBe(2);
      expect(merged.decrements['nodeD']).toBeUndefined(); // No decrement for D

      expect(merged.sku).toBe(SKU);

      expect(CRDTStockResolver.getValue(merged)).toBe((10 + 5 + 7) - (5 + 4 + 2)); // 22 - 11 = 11
    });
  });
});
