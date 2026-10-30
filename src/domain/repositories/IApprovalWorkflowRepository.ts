export interface ApprovalWorkflowRecord {
  id: string;
  tenantId: string;
  name: string;
  triggerEvent: string;
  isActive: boolean;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalDecisionData {
  id: string;
  stepIndex: number;
  deciderId: string;
  decision: 'APPROVED' | 'REJECTED' | string;
  notes?: string | null;
  decidedAt?: Date;
}

export interface ApprovalRequestRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  referenceType: string;
  referenceId: string;
  requesterId: string;
  status: string;
  currentStep: number;
  payload: any;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workflow?: ApprovalWorkflowRecord;
  decisions?: ApprovalDecisionData[];
}

export interface IApprovalWorkflowRepository {
  findWorkflowByTrigger(tenantId: string, triggerEvent: string): Promise<ApprovalWorkflowRecord | null>;
  createApprovalRequest(data: {
    id: string;
    tenantId: string;
    workflowId: string;
    referenceType: string;
    referenceId: string;
    requesterId: string;
    status: string;
    currentStep: number;
    payload: any;
    expiresAt: Date | null;
  }): Promise<ApprovalRequestRecord>;
  findApprovalRequestById(id: string): Promise<ApprovalRequestRecord | null>;
  saveDecisionAndUpdateRequest(
    decision: ApprovalDecisionData,
    requestId: string,
    updateData: { status: string; currentStep: number }
  ): Promise<void>;
  findStaleRequests(now: Date): Promise<ApprovalRequestRecord[]>;
  updateApprovalRequest(
    requestId: string,
    updateData: { status: string; currentStep: number; expiresAt: Date | null }
  ): Promise<void>;
  findPendingRequests(tenantId: string): Promise<ApprovalRequestRecord[]>;
}
