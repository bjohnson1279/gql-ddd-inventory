/**
 * ApprovalRequest Domain Entity (Aggregate Root)
 *
 * Represents a pending approval request created when a domain action
 * triggers an approval workflow. Manages the status machine:
 *
 *   PENDING → APPROVED (all steps satisfied)
 *   PENDING → REJECTED (any step rejected)
 *   PENDING → ESCALATED (timeout, bumped to next step or admin)
 *   PENDING → EXPIRED (final timeout, no action)
 */

export enum ApprovalRequestStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Escalated = 'ESCALATED',
  Expired = 'EXPIRED',
}

export interface ApprovalDecisionRecord {
  id: string;
  stepIndex: number;
  deciderId: string;
  decision: 'APPROVED' | 'REJECTED';
  notes?: string;
  decidedAt: Date;
}

export class ApprovalRequest {
  private _status: ApprovalRequestStatus;
  private _currentStep: number;
  private _decisions: ApprovalDecisionRecord[];

  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly workflowId: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly requesterId: string,
    public readonly payload: Record<string, any>,
    public readonly totalSteps: number,
    status: ApprovalRequestStatus = ApprovalRequestStatus.Pending,
    currentStep: number = 0,
    decisions: ApprovalDecisionRecord[] = [],
    public readonly expiresAt?: Date,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this._status = status;
    this._currentStep = currentStep;
    this._decisions = [...decisions];
  }

  get status(): ApprovalRequestStatus {
    return this._status;
  }

  get currentStep(): number {
    return this._currentStep;
  }

  get decisions(): ApprovalDecisionRecord[] {
    return [...this._decisions];
  }

  /**
   * Records an approval decision for the current step.
   * If all required approvals at the current step are met, advances to the next step.
   * If all steps are complete, transitions to APPROVED.
   */
  approve(decision: ApprovalDecisionRecord, requiredCount: number): void {
    if (this._status !== ApprovalRequestStatus.Pending) {
      throw new Error(`Cannot approve request in status: ${this._status}`);
    }
    if (decision.stepIndex !== this._currentStep) {
      throw new Error(`Decision step ${decision.stepIndex} does not match current step ${this._currentStep}.`);
    }

    this._decisions.push(decision);

    // Count approvals at the current step
    const currentStepApprovals = this._decisions.filter(
      d => d.stepIndex === this._currentStep && d.decision === 'APPROVED'
    ).length;

    if (currentStepApprovals >= requiredCount) {
      // Advance to next step or complete
      if (this._currentStep + 1 >= this.totalSteps) {
        this._status = ApprovalRequestStatus.Approved;
      } else {
        this._currentStep += 1;
      }
    }
  }

  /**
   * Records a rejection at any step. Immediately transitions to REJECTED.
   */
  reject(decision: ApprovalDecisionRecord): void {
    if (this._status !== ApprovalRequestStatus.Pending) {
      throw new Error(`Cannot reject request in status: ${this._status}`);
    }
    if (decision.decision !== 'REJECTED') {
      throw new Error('Rejection decision must have decision = REJECTED.');
    }

    this._decisions.push(decision);
    this._status = ApprovalRequestStatus.Rejected;
  }

  /**
   * Escalates to the next step due to timeout.
   * If already at the last step, transitions to EXPIRED.
   */
  escalate(): void {
    if (this._status !== ApprovalRequestStatus.Pending) {
      throw new Error(`Cannot escalate request in status: ${this._status}`);
    }

    if (this._currentStep + 1 >= this.totalSteps) {
      this._status = ApprovalRequestStatus.Expired;
    } else {
      this._currentStep += 1;
      this._status = ApprovalRequestStatus.Escalated;
    }
  }

  /**
   * Force-expires the request (e.g., by cron job after final timeout).
   */
  expire(): void {
    if (this._status !== ApprovalRequestStatus.Pending && this._status !== ApprovalRequestStatus.Escalated) {
      throw new Error(`Cannot expire request in status: ${this._status}`);
    }
    this._status = ApprovalRequestStatus.Expired;
  }

  /**
   * Returns true if the request is still actionable.
   */
  get isPending(): boolean {
    return this._status === ApprovalRequestStatus.Pending || this._status === ApprovalRequestStatus.Escalated;
  }

  /**
   * Reconstructs an ApprovalRequest from persistence.
   */
  static reconstruct(
    id: string,
    tenantId: string,
    workflowId: string,
    referenceType: string,
    referenceId: string,
    requesterId: string,
    payload: Record<string, any>,
    totalSteps: number,
    status: ApprovalRequestStatus,
    currentStep: number,
    decisions: ApprovalDecisionRecord[],
    expiresAt?: Date,
    createdAt?: Date,
    updatedAt?: Date
  ): ApprovalRequest {
    return new ApprovalRequest(
      id, tenantId, workflowId, referenceType, referenceId, requesterId,
      payload, totalSteps, status, currentStep, decisions,
      expiresAt, createdAt, updatedAt
    );
  }
}
