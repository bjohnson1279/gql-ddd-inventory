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

  describe('evaluateAndIntercept edge cases', () => {
    it('should not intercept if workflow is inactive', async () => {
      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval',
        triggerEvent: 'purchase_order.place',
        isActive: false,
        config: { thresholds: [], steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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

    it('should not intercept if workflow thresholds are not satisfied', async () => {
      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval',
        triggerEvent: 'purchase_order.place',
        isActive: true,
        config: {
          thresholds: [{ field: 'totalCents', operator: '>=', value: 10000 }],
          steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'purchase_order.place',
        'PurchaseOrder',
        'po-123',
        'user-1',
        { totalCents: 5000 }
      );

      expect(result.intercepted).toBe(false);
      expect(result.requestId).toBeUndefined();
      expect(repoMock.createApprovalRequest).not.toHaveBeenCalled();
    });

    it('should calculate expiresAt when first step has timeoutHours > 0', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval',
        triggerEvent: 'purchase_order.place',
        isActive: true,
        config: {
          thresholds: [],
          steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 12 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      repoMock.createApprovalRequest.mockResolvedValue({} as any);

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'purchase_order.place',
        'PurchaseOrder',
        'po-123',
        'user-1',
        {}
      );

      expect(result.intercepted).toBe(true);
      expect(repoMock.createApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(now + 12 * 60 * 60 * 1000),
          status: 'PENDING',
          currentStep: 0,
        })
      );
      jest.restoreAllMocks();
    });

    it('should set expiresAt to null if first step has timeoutHours <= 0', async () => {
      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval',
        triggerEvent: 'purchase_order.place',
        isActive: true,
        config: {
          thresholds: [],
          steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 0 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      repoMock.createApprovalRequest.mockResolvedValue({} as any);

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'purchase_order.place',
        'PurchaseOrder',
        'po-123',
        'user-1',
        {}
      );

      expect(result.intercepted).toBe(true);
      expect(repoMock.createApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: null,
        })
      );
    });
  });

  describe('processDecision', () => {
    it('throws error when approval request is not found', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue(null);

      await expect(
        service.processDecision('non-existent', 'user-2', 'APPROVED')
      ).rejects.toThrow('Approval request non-existent not found.');
    });

    it('throws error when request has no workflow', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-1',
        workflow: undefined,
      } as any);

      await expect(
        service.processDecision('req-1', 'user-2', 'APPROVED')
      ).rejects.toThrow('Approval request req-1 not found.');
    });

    it('processes approval and dispatches event when final step is approved', async () => {
      const mockDispatcher = { dispatch: jest.fn() };
      const serviceWithDispatcher = new ApprovalWorkflowService(repoMock, mockDispatcher);

      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-123',
        requesterId: 'user-1',
        payload: { amount: 1000 },
        status: 'PENDING',
        currentStep: 0,
        decisions: [],
        workflow: {
          config: {
            thresholds: [],
            steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
          },
        },
      } as any);

      repoMock.saveDecisionAndUpdateRequest.mockResolvedValue(undefined as any);

      const result = await serviceWithDispatcher.processDecision('req-1', 'decider-1', 'APPROVED', 'Looks good');

      expect(result.status).toBe('APPROVED');
      expect(result.referenceType).toBe('PurchaseOrder');
      expect(result.referenceId).toBe('po-123');
      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          deciderId: 'decider-1',
          decision: 'APPROVED',
          notes: 'Looks good',
        }),
        'req-1',
        { status: 'APPROVED', currentStep: 0 }
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatcher.dispatch.mock.calls[0][0][0]).toBeInstanceOf(require('../../../src/domain/events/ApprovalEvents').ApprovalRequestApprovedEvent);
    });

    it('processes multi-step approval without completing workflow until final step', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-123',
        requesterId: 'user-1',
        payload: { amount: 1000 },
        status: 'PENDING',
        currentStep: 0,
        decisions: [],
        workflow: {
          config: {
            thresholds: [],
            steps: [
              { approverRoles: ['team_lead'], requiredCount: 1, timeoutHours: 24 },
              { approverRoles: ['director'], requiredCount: 1, timeoutHours: 24 },
            ],
          },
        },
      } as any);

      repoMock.saveDecisionAndUpdateRequest.mockResolvedValue(undefined as any);

      const result = await service.processDecision('req-1', 'decider-1', 'APPROVED');

      expect(result.status).toBe('PENDING');
      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.any(Object),
        'req-1',
        { status: 'PENDING', currentStep: 1 }
      );
    });

    it('processes rejection and dispatches rejection event', async () => {
      const mockDispatcher = { dispatch: jest.fn() };
      const serviceWithDispatcher = new ApprovalWorkflowService(repoMock, mockDispatcher);

      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-123',
        requesterId: 'user-1',
        payload: { amount: 1000 },
        status: 'PENDING',
        currentStep: 0,
        decisions: [],
        workflow: {
          config: {
            thresholds: [],
            steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
          },
        },
      } as any);

      repoMock.saveDecisionAndUpdateRequest.mockResolvedValue(undefined as any);

      const result = await serviceWithDispatcher.processDecision('req-1', 'decider-1', 'REJECTED', 'Budget exceeded');

      expect(result.status).toBe('REJECTED');
      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          deciderId: 'decider-1',
          decision: 'REJECTED',
          notes: 'Budget exceeded',
        }),
        'req-1',
        { status: 'REJECTED', currentStep: 0 }
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatcher.dispatch.mock.calls[0][0][0]).toBeInstanceOf(require('../../../src/domain/events/ApprovalEvents').ApprovalRequestRejectedEvent);
    });

    it('maps existing decisions when reconstructing request', async () => {
      const pastDate = new Date('2025-01-01');
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-123',
        requesterId: 'user-1',
        payload: { amount: 1000 },
        status: 'PENDING',
        currentStep: 0,
        decisions: [
          {
            id: 'dec-0',
            stepIndex: 0,
            deciderId: 'first-approver',
            decision: 'APPROVED',
            notes: null,
            decidedAt: pastDate,
          },
        ],
        workflow: {
          config: {
            thresholds: [],
            steps: [{ approverRoles: ['manager'], requiredCount: 2, timeoutHours: 24 }],
          },
        },
      } as any);

      repoMock.saveDecisionAndUpdateRequest.mockResolvedValue(undefined as any);

      const result = await service.processDecision('req-1', 'second-approver', 'APPROVED');

      expect(result.status).toBe('APPROVED');
      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.any(Object),
        'req-1',
        { status: 'APPROVED', currentStep: 0 }
      );
    });
  });

  describe('checkExpiredRequests', () => {
    it('escalates stale pending requests to the next step and updates expiration', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'req-stale-1',
          tenantId: 'tenant-1',
          workflowId: 'wf-1',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-1',
          requesterId: 'user-1',
          payload: {},
          status: 'PENDING',
          currentStep: 0,
          expiresAt: new Date(now - 1000),
          workflow: {
            config: {
              thresholds: [],
              steps: [
                { approverRoles: ['lead'], requiredCount: 1, timeoutHours: 24 },
                { approverRoles: ['manager'], requiredCount: 1, timeoutHours: 48 },
              ],
            },
          },
        } as any,
      ]);

      repoMock.updateApprovalRequest.mockResolvedValue(undefined as any);

      const count = await service.checkExpiredRequests();

      expect(count).toBe(1);
      expect(repoMock.updateApprovalRequest).toHaveBeenCalledWith('req-stale-1', {
        status: 'ESCALATED',
        currentStep: 1,
        expiresAt: new Date(now + 48 * 60 * 60 * 1000),
      });
      jest.restoreAllMocks();
    });

    it('expires stale requests that are at the final step', async () => {
      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'req-stale-final',
          tenantId: 'tenant-1',
          workflowId: 'wf-1',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-2',
          requesterId: 'user-1',
          payload: {},
          status: 'PENDING',
          currentStep: 1,
          expiresAt: new Date(),
          workflow: {
            config: {
              thresholds: [],
              steps: [
                { approverRoles: ['lead'], requiredCount: 1, timeoutHours: 24 },
                { approverRoles: ['manager'], requiredCount: 1, timeoutHours: 48 },
              ],
            },
          },
        } as any,
      ]);

      repoMock.updateApprovalRequest.mockResolvedValue(undefined as any);

      const count = await service.checkExpiredRequests();

      expect(count).toBe(1);
      expect(repoMock.updateApprovalRequest).toHaveBeenCalledWith('req-stale-final', {
        status: 'EXPIRED',
        currentStep: 1,
        expiresAt: null,
      });
    });

    it('skips stale records missing workflow data', async () => {
      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'req-broken',
          workflow: undefined,
        } as any,
      ]);

      const count = await service.checkExpiredRequests();

      expect(count).toBe(0);
      expect(repoMock.updateApprovalRequest).not.toHaveBeenCalled();
    });
  });

  describe('listPendingRequests', () => {
    const mockRequests = [
      {
        id: 'req-1',
        currentStep: 0,
        workflow: {
          config: {
            steps: [{ approverRoles: ['role-a', 'role-b'] }],
          },
        },
      },
      {
        id: 'req-2',
        currentStep: 0,
        workflow: {
          config: {
            steps: [{ approverRoles: ['role-c'] }],
          },
        },
      },
      {
        id: 'req-3',
        currentStep: 1,
        workflow: null,
      },
      {
        id: 'req-4',
        currentStep: 5,
        workflow: {
          config: {
            steps: [{ approverRoles: ['role-a'] }],
          },
        },
      },
    ];

    it('returns all pending requests if deciderRoleIds is not provided or empty', async () => {
      repoMock.findPendingRequests.mockResolvedValue(mockRequests as any);

      const res1 = await service.listPendingRequests('tenant-1');
      expect(res1).toEqual(mockRequests);

      const res2 = await service.listPendingRequests('tenant-1', []);
      expect(res2).toEqual(mockRequests);
    });

    it('filters pending requests based on overlapping roles for current step', async () => {
      repoMock.findPendingRequests.mockResolvedValue(mockRequests as any);

      const res = await service.listPendingRequests('tenant-1', ['role-a']);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('req-1');
    });
  });
});
