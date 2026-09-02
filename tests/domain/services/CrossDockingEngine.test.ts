import { CrossDockingEngine } from '../../../src/domain/services/CrossDockingEngine';

describe('CrossDockingEngine', () => {
  it('should return empty opportunities when no backorders match', () => {
    const opportunities = CrossDockingEngine.evaluate(
      'PO-1',
      [{ variantId: 'V1', quantity: 10 }],
      [{ orderId: 'O1', variantId: 'V2', quantity: 5 }]
    );
    expect(opportunities).toHaveLength(0);
  });

  it('should match inbound quantities to backorders of the same variant', () => {
    const opportunities = CrossDockingEngine.evaluate(
      'PO-1',
      [{ variantId: 'V1', quantity: 10 }],
      [{ orderId: 'O1', variantId: 'V1', quantity: 10 }]
    );
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].recommendedCrossDockQuantity).toBe(10);
    expect(opportunities[0].matchingBackorders).toHaveLength(1);
    expect(opportunities[0].matchingBackorders[0].requiredQuantity).toBe(10);
  });

  it('should prioritize backorders with higher priority when inbound quantity is limited', () => {
    const opportunities = CrossDockingEngine.evaluate(
      'PO-1',
      [{ variantId: 'V1', quantity: 5 }],
      [
        { orderId: 'O1', variantId: 'V1', quantity: 5, priority: 1 },
        { orderId: 'O2', variantId: 'V1', quantity: 5, priority: 5 }
      ]
    );
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].recommendedCrossDockQuantity).toBe(5);
    expect(opportunities[0].matchingBackorders).toHaveLength(1);
    expect(opportunities[0].matchingBackorders[0].orderId).toBe('O2');
  });

  it('should handle partial fulfillment of backorders', () => {
    const opportunities = CrossDockingEngine.evaluate(
      'PO-1',
      [{ variantId: 'V1', quantity: 5 }],
      [{ orderId: 'O1', variantId: 'V1', quantity: 10 }]
    );
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].recommendedCrossDockQuantity).toBe(5);
    expect(opportunities[0].matchingBackorders[0].requiredQuantity).toBe(5);
  });

  it('should handle excess inbound quantities', () => {
    const opportunities = CrossDockingEngine.evaluate(
      'PO-1',
      [{ variantId: 'V1', quantity: 15 }],
      [{ orderId: 'O1', variantId: 'V1', quantity: 10 }]
    );
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].recommendedCrossDockQuantity).toBe(10);
    expect(opportunities[0].matchingBackorders[0].requiredQuantity).toBe(10);
  });
});
