import { ApprovalWorkflow, ApprovalWorkflowConfig } from '../../../src/domain/entities/ApprovalWorkflow';

describe('ApprovalWorkflow Domain Entity', () => {
  const defaultConfig: ApprovalWorkflowConfig = {
    thresholds: [
      { field: 'amount', operator: '>=', value: 1000 }
    ],
    steps: [
      { approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }
    ]
  };

  describe('Constructor', () => {
    it('throws on empty triggerEvent', () => {
      expect(() => {
        new ApprovalWorkflow('id', 'tenant', 'name', '', true, defaultConfig);
      }).toThrow('Approval workflow trigger event cannot be empty.');
    });

    it('throws on empty steps', () => {
      const configNoSteps: ApprovalWorkflowConfig = { thresholds: [], steps: [] };
      expect(() => {
        new ApprovalWorkflow('id', 'tenant', 'name', 'event', true, configNoSteps);
      }).toThrow('Approval workflow must define at least one approval step.');
    });
  });

  describe('shouldTrigger', () => {
    it('returns false when inactive', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'event', false, defaultConfig);
      expect(workflow.shouldTrigger({ amount: 1500 })).toBe(false);
    });

    it('returns true when thresholds array empty', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'event', true, { thresholds: [], steps: defaultConfig.steps });
      expect(workflow.shouldTrigger({ amount: 10 })).toBe(true);
    });

    it('returns true when all thresholds met', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'event', true, defaultConfig);
      expect(workflow.shouldTrigger({ amount: 1000 })).toBe(true);
      expect(workflow.shouldTrigger({ amount: 2000 })).toBe(true);
    });

    it('returns false when threshold not met', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'event', true, defaultConfig);
      expect(workflow.shouldTrigger({ amount: 999 })).toBe(false);
    });

    it('returns false when payload field is null or undefined', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'event', true, defaultConfig);
      expect(workflow.shouldTrigger({ amount: null })).toBe(false);
      expect(workflow.shouldTrigger({})).toBe(false);
    });

    it('All 6 operators work correctly', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'event', true, {
        thresholds: [
          { field: 'gte', operator: '>=', value: 10 },
          { field: 'gt', operator: '>', value: 10 },
          { field: 'lte', operator: '<=', value: 10 },
          { field: 'lt', operator: '<', value: 10 },
          { field: 'eq', operator: '==', value: 10 },
          { field: 'neq', operator: '!=', value: 10 }
        ],
        steps: defaultConfig.steps
      });

      expect(workflow.shouldTrigger({
        gte: 10, gt: 11, lte: 10, lt: 9, eq: 10, neq: 11
      })).toBe(true);

      // Failing each
      const pass = { gte: 10, gt: 11, lte: 10, lt: 9, eq: 10, neq: 11 };
      expect(workflow.shouldTrigger({ ...pass, gte: 9 })).toBe(false);
      expect(workflow.shouldTrigger({ ...pass, gt: 10 })).toBe(false);
      expect(workflow.shouldTrigger({ ...pass, lte: 11 })).toBe(false);
      expect(workflow.shouldTrigger({ ...pass, lt: 10 })).toBe(false);
      expect(workflow.shouldTrigger({ ...pass, eq: 11 })).toBe(false);
      expect(workflow.shouldTrigger({ ...pass, neq: 10 })).toBe(false);
    });
  });
});
