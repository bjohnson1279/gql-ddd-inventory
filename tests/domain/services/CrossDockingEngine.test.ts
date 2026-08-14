import { CrossDockingEngine, CrossDockOpportunity } from '../../../src/domain/services/CrossDockingEngine';

describe('CrossDockingEngine', () => {
  describe('evaluate', () => {
    it('should return no opportunities when there are no inbound items', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [],
        [{ orderId: 'O-1', variantId: 'V-1', quantity: 10, priority: 1 }]
      );
      expect(result).toHaveLength(0);
    });

    it('should return no opportunities when there are no backorders', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [{ variantId: 'V-1', quantity: 10 }],
        []
      );
      expect(result).toHaveLength(0);
    });

    it('should return no opportunities when variantIds do not match', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [{ variantId: 'V-1', quantity: 10 }],
        [{ orderId: 'O-1', variantId: 'V-2', quantity: 10, priority: 1 }]
      );
      expect(result).toHaveLength(0);
    });

    it('should match a single inbound item with a single backorder exactly', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [{ variantId: 'V-1', quantity: 10 }],
        [{ orderId: 'O-1', variantId: 'V-1', quantity: 10, priority: 1 }]
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        purchaseOrderId: 'PO-123',
        variantId: 'V-1',
        inboundQuantity: 10,
        matchingBackorders: [
          { orderId: 'O-1', requiredQuantity: 10, priority: 1 }
        ],
        recommendedCrossDockQuantity: 10,
        destinationBay: 'DOCK-OUTBOUND-BAY-01',
      });
    });

    it('should prioritize backorders with higher priority when inbound quantity is limited', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [{ variantId: 'V-1', quantity: 15 }],
        [
          { orderId: 'O-1', variantId: 'V-1', quantity: 10, priority: 1 },
          { orderId: 'O-2', variantId: 'V-1', quantity: 10, priority: 5 }, // Higher priority
          { orderId: 'O-3', variantId: 'V-1', quantity: 10, priority: 2 }
        ]
      );

      expect(result).toHaveLength(1);
      const opportunity = result[0];

      expect(opportunity.matchingBackorders).toHaveLength(2);
      expect(opportunity.matchingBackorders[0]).toEqual({
        orderId: 'O-2', requiredQuantity: 10, priority: 5
      });
      expect(opportunity.matchingBackorders[1]).toEqual({
        orderId: 'O-3', requiredQuantity: 5, priority: 2 // Partial fulfillment
      });
      expect(opportunity.recommendedCrossDockQuantity).toBe(15);
    });

    it('should default priority to 0 if not specified, but assign priority 1 in output according to code logic', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [{ variantId: 'V-1', quantity: 15 }],
        [
          { orderId: 'O-1', variantId: 'V-1', quantity: 10 } // No priority specified
        ]
      );

      expect(result).toHaveLength(1);
      expect(result[0].matchingBackorders[0]).toEqual({
        orderId: 'O-1', requiredQuantity: 10, priority: 1 // Code explicitly assigns default 1 in the output object
      });
    });

    it('should fully fulfill backorders when inbound quantity is greater than total demand', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [{ variantId: 'V-1', quantity: 50 }],
        [
          { orderId: 'O-1', variantId: 'V-1', quantity: 10, priority: 1 },
          { orderId: 'O-2', variantId: 'V-1', quantity: 15, priority: 2 }
        ]
      );

      expect(result).toHaveLength(1);
      expect(result[0].recommendedCrossDockQuantity).toBe(25); // Only what was assigned
      expect(result[0].matchingBackorders).toHaveLength(2);
      expect(result[0].matchingBackorders[0].requiredQuantity).toBe(15); // O-2, priority 2
      expect(result[0].matchingBackorders[1].requiredQuantity).toBe(10); // O-1, priority 1
    });

    it('should handle multiple inbound items and match them independently', () => {
      const result = CrossDockingEngine.evaluate(
        'PO-123',
        [
          { variantId: 'V-1', quantity: 10 },
          { variantId: 'V-2', quantity: 20 }
        ],
        [
          { orderId: 'O-1', variantId: 'V-2', quantity: 5, priority: 1 },
          { orderId: 'O-2', variantId: 'V-1', quantity: 15, priority: 2 }
        ]
      );

      expect(result).toHaveLength(2);

      // V-1 match
      const matchV1 = result.find((r) => r.variantId === 'V-1');
      expect(matchV1?.recommendedCrossDockQuantity).toBe(10);
      expect(matchV1?.matchingBackorders[0].orderId).toBe('O-2');
      expect(matchV1?.matchingBackorders[0].requiredQuantity).toBe(10);

      // V-2 match
      const matchV2 = result.find((r) => r.variantId === 'V-2');
      expect(matchV2?.recommendedCrossDockQuantity).toBe(5);
      expect(matchV2?.matchingBackorders[0].orderId).toBe('O-1');
      expect(matchV2?.matchingBackorders[0].requiredQuantity).toBe(5);
    });
  });
});
