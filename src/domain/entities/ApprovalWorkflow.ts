/**
 * ApprovalWorkflow Domain Entity
 *
 * Defines a configurable approval workflow that intercepts domain actions
 * (e.g., PO placement) when threshold conditions are met.
 */

export interface ApprovalStepConfig {
  /** Roles that can approve at this step */
  approverRoles: string[];
  /** Number of approvals required at this step (default: 1) */
  requiredCount: number;
  /** Hours before this step auto-escalates to the next step */
  timeoutHours: number;
}

export interface ThresholdCondition {
  /** The payload field to evaluate (e.g., 'totalValueCents') */
  field: string;
  /** Comparison operator */
  operator: '>=' | '>' | '<=' | '<' | '==' | '!=';
  /** The threshold value */
  value: number;
}

export interface ApprovalWorkflowConfig {
  /** Conditions that must ALL be met for the workflow to trigger */
  thresholds: ThresholdCondition[];
  /** Ordered approval steps */
  steps: ApprovalStepConfig[];
}

export class ApprovalWorkflow {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly triggerEvent: string,
    public readonly isActive: boolean,
    public readonly config: ApprovalWorkflowConfig,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    if (!triggerEvent || triggerEvent.trim().length === 0) {
      throw new Error('Approval workflow trigger event cannot be empty.');
    }
    if (!config.steps || config.steps.length === 0) {
      throw new Error('Approval workflow must define at least one approval step.');
    }
  }

  /**
   * Evaluates whether this workflow should trigger for a given payload.
   * All threshold conditions must be satisfied (AND logic).
   */
  shouldTrigger(payload: Record<string, any>): boolean {
    if (!this.isActive) return false;
    if (this.config.thresholds.length === 0) return true; // No thresholds = always trigger

    return this.config.thresholds.every(threshold => {
      const value = payload[threshold.field];
      if (value === undefined || value === null) return false;

      switch (threshold.operator) {
        case '>=': return value >= threshold.value;
        case '>':  return value > threshold.value;
        case '<=': return value <= threshold.value;
        case '<':  return value < threshold.value;
        case '==': return value === threshold.value;
        case '!=': return value !== threshold.value;
        default:   return false;
      }
    });
  }

  /**
   * Returns the step configuration at a given index.
   */
  getStep(index: number): ApprovalStepConfig | undefined {
    return this.config.steps[index];
  }

  /**
   * Returns the total number of approval steps.
   */
  get totalSteps(): number {
    return this.config.steps.length;
  }
}
