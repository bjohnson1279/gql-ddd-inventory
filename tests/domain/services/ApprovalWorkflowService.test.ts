import { ApprovalWorkflowService } from '../../../src/domain/services/ApprovalWorkflowService';
import { IApprovalWorkflowRepository } from '../../../src/domain/repositories/IApprovalWorkflowRepository';

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;
  let repoMock: jest.Mocked<IApprovalWorkflowRepository>;

  beforeEach(() => {
    repoMock = {
      findWorkflowByTrigger: jest.fn(),
      createApprovalRequest: jest.fn(),
      findApprovalRequestById: jest.fn(),
      saveDecisionAndUpdateRequest: jest.fn(),
      findStaleRequests: jest.fn(),
      updateApprovalRequest: jest.fn(),
      findPendingRequests: jest.fn(),
    };
    service = new ApprovalWorkflowService(repoMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not intercept if no workflow exists for the trigger event', async () => {
    repoMock.findWorkflowByTrigger.mockResolvedValue(null);

    const result = await service.evaluateAndIntercept(
      'tenant-1',
      'purchase_order.place',
      'PurchaseOrder',
      'po-123',
      'user-1',
      { totalCents: 50000 }
    );

    expect(result.intercepted).toBe(false);
    expect(result.requestId).toBeUndefined();
    expect(repoMock.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('should intercept if active workflow exists', async () => {
    repoMock.findWorkflowByTrigger.mockResolvedValue({
      id: 'wf-1',
      tenantId: 'tenant-1',
      name: 'PO Approval',
      triggerEvent: 'purchase_order.place',
      isActive: true,
      config: { thresholds: [], steps: [{ roleId: 'finance_auditor', minApprovals: 1, timeoutHours: 24 }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    repoMock.createApprovalRequest.mockResolvedValue({
      id: 'req-1',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      referenceType: 'PurchaseOrder',
      referenceId: 'po-123',
      requesterId: 'user-1',
      status: 'PENDING',
      currentStep: 0,
      payload: { totalCents: 5000000 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.evaluateAndIntercept(
      'tenant-1',
      'purchase_order.place',
      'PurchaseOrder',
      'po-123',
      'user-1',
      { totalCents: 5000000 }
    );

    expect(result.intercepted).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(repoMock.createApprovalRequest).toHaveBeenCalled();
  });
});
