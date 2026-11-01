import { ApprovalWorkflowService, IEventDispatcher } from '../../../src/domain/services/ApprovalWorkflowService';
import { IApprovalWorkflowRepository, ApprovalRequestRecord } from '../../../src/domain/repositories/IApprovalWorkflowRepository';
import { ApprovalRequestStatus } from '../../../src/domain/entities/ApprovalRequest';
import { ApprovalRequestApprovedEvent, ApprovalRequestRejectedEvent } from '../../../src/domain/events/ApprovalEvents';

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;
  let repoMock: jest.Mocked<IApprovalWorkflowRepository>;
  let eventDispatcherMock: jest.Mocked<IEventDispatcher>;

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
    eventDispatcherMock = {
      dispatch: jest.fn(),
    };
    service = new ApprovalWorkflowService(repoMock, eventDispatcherMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateAndIntercept', () => {
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

    it('should not intercept if workflow exists but isActive is false', async () => {
      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-inactive',
        tenantId: 'tenant-1',
        name: 'PO Approval Inactive',
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

    it('should not intercept if payload does not meet workflow threshold conditions', async () => {
      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval High Value',
        triggerEvent: 'purchase_order.place',
        isActive: true,
        config: {
          thresholds: [{ field: 'totalCents', operator: '>=', value: 100000 }],
          steps: [{ approverRoles: ['finance_manager'], requiredCount: 1, timeoutHours: 12 }],
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
        { totalCents: 50000 }
      );

      expect(result.intercepted).toBe(false);
      expect(result.requestId).toBeUndefined();
      expect(repoMock.createApprovalRequest).not.toHaveBeenCalled();
    });

    it('should intercept if active workflow exists and thresholds are met, setting expiresAt based on first step timeout', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval',
        triggerEvent: 'purchase_order.place',
        isActive: true,
        config: {
          thresholds: [{ field: 'totalCents', operator: '>=', value: 10000 }],
          steps: [
            { approverRoles: ['finance_auditor'], requiredCount: 1, timeoutHours: 24 },
            { approverRoles: ['director'], requiredCount: 2, timeoutHours: 48 },
          ],
        },
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
      expect(repoMock.createApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.requestId,
          tenantId: 'tenant-1',
          workflowId: 'wf-1',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-123',
          requesterId: 'user-1',
          status: 'PENDING',
          currentStep: 0,
          payload: { totalCents: 5000000 },
          expiresAt: new Date(now + 24 * 60 * 60 * 1000),
        })
      );

      jest.restoreAllMocks();
    });

    it('should set expiresAt to null if first step has zero timeoutHours', async () => {
      repoMock.findWorkflowByTrigger.mockResolvedValue({
        id: 'wf-no-timeout',
        tenantId: 'tenant-1',
        name: 'Unlimited PO Approval',
        triggerEvent: 'purchase_order.place',
        isActive: true,
        config: {
          thresholds: [],
          steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 0 }],
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
        { totalCents: 500 }
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
    it('throws an error if approval request is not found', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue(null);

      await expect(
        service.processDecision('non-existent-id', 'user-approver', 'APPROVED')
      ).rejects.toThrow('Approval request non-existent-id not found.');
    });

    it('throws an error if approval request has no workflow record associated', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-no-wf',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-1',
        requesterId: 'user-1',
        status: 'PENDING',
        currentStep: 0,
        payload: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: undefined,
      });

      await expect(
        service.processDecision('req-no-wf', 'user-approver', 'APPROVED')
      ).rejects.toThrow('Approval request req-no-wf not found.');
    });

    it('processes REJECTED decision: marks request rejected and dispatches ApprovalRequestRejectedEvent', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-rej',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-100',
        requesterId: 'user-requester',
        status: 'PENDING',
        currentStep: 0,
        payload: { totalCents: 20000 },
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          id: 'wf-1',
          tenantId: 'tenant-1',
          name: 'PO Approval',
          triggerEvent: 'po.placed',
          isActive: true,
          config: {
            thresholds: [],
            steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await service.processDecision(
        'req-rej',
        'manager-1',
        'REJECTED',
        'Exceeds team budget'
      );

      expect(result).toEqual({
        status: ApprovalRequestStatus.Rejected,
        referenceType: 'PurchaseOrder',
        referenceId: 'po-100',
      });

      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          stepIndex: 0,
          deciderId: 'manager-1',
          decision: 'REJECTED',
          notes: 'Exceeds team budget',
        }),
        'req-rej',
        {
          status: ApprovalRequestStatus.Rejected,
          currentStep: 0,
        }
      );

      expect(eventDispatcherMock.dispatch).toHaveBeenCalledTimes(1);
      const dispatchedEvents = eventDispatcherMock.dispatch.mock.calls[0][0];
      expect(dispatchedEvents).toHaveLength(1);
      expect(dispatchedEvents[0]).toBeInstanceOf(ApprovalRequestRejectedEvent);
      expect(dispatchedEvents[0].requestId).toBe('req-rej');
      expect(dispatchedEvents[0].tenantId).toBe('tenant-1');
      expect(dispatchedEvents[0].referenceType).toBe('PurchaseOrder');
      expect(dispatchedEvents[0].referenceId).toBe('po-100');
      expect(dispatchedEvents[0].payload).toEqual({ totalCents: 20000 });
      expect(dispatchedEvents[0].occurredAt).toBeInstanceOf(Date);
    });

    it('processes APPROVED decision for multi-step workflow without completing final step (advances step)', async () => {
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-multistep',
        tenantId: 'tenant-1',
        workflowId: 'wf-multi',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-multi-1',
        requesterId: 'requester-1',
        status: 'PENDING',
        currentStep: 0,
        payload: { totalCents: 50000 },
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          id: 'wf-multi',
          tenantId: 'tenant-1',
          name: 'Multi Step PO Approval',
          triggerEvent: 'po.placed',
          isActive: true,
          config: {
            thresholds: [],
            steps: [
              { approverRoles: ['lead'], requiredCount: 1, timeoutHours: 12 },
              { approverRoles: ['director'], requiredCount: 1, timeoutHours: 24 },
            ],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await service.processDecision('req-multistep', 'lead-user', 'APPROVED');

      expect(result.status).toBe(ApprovalRequestStatus.Pending);
      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          stepIndex: 0,
          deciderId: 'lead-user',
          decision: 'APPROVED',
        }),
        'req-multistep',
        {
          status: ApprovalRequestStatus.Pending,
          currentStep: 1,
        }
      );
      expect(eventDispatcherMock.dispatch).not.toHaveBeenCalled();
    });

    it('processes APPROVED decision completing all steps with existing decisions and custom/fallback values', async () => {
      const pastDate = new Date('2025-01-01T00:00:00Z');
      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-final',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'StockTransfer',
        referenceId: 'transfer-99',
        requesterId: 'worker-1',
        status: 'PENDING',
        currentStep: 1,
        payload: { itemId: 'item-1', qty: 50 },
        createdAt: new Date(),
        updatedAt: new Date(),
        decisions: [
          {
            id: 'dec-0',
            stepIndex: 0,
            deciderId: 'lead-1',
            decision: 'APPROVED',
            notes: null,
            decidedAt: undefined,
          },
          {
            id: 'dec-0-extra',
            stepIndex: 0,
            deciderId: 'lead-2',
            decision: 'APPROVED',
            notes: 'Existing note',
            decidedAt: pastDate,
          },
        ],
        workflow: {
          id: 'wf-1',
          tenantId: 'tenant-1',
          name: 'Transfer Approval',
          triggerEvent: 'transfer.requested',
          isActive: true,
          config: {
            thresholds: [],
            steps: [
              { approverRoles: ['lead'], requiredCount: 1, timeoutHours: 24 },
              { approverRoles: ['manager'], requiredCount: undefined as any, timeoutHours: 24 },
            ],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await service.processDecision('req-final', 'manager-1', 'APPROVED', 'Looks good');

      expect(result).toEqual({
        status: ApprovalRequestStatus.Approved,
        referenceType: 'StockTransfer',
        referenceId: 'transfer-99',
      });

      expect(repoMock.saveDecisionAndUpdateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          stepIndex: 1,
          deciderId: 'manager-1',
          decision: 'APPROVED',
          notes: 'Looks good',
        }),
        'req-final',
        {
          status: ApprovalRequestStatus.Approved,
          currentStep: 1,
        }
      );

      expect(eventDispatcherMock.dispatch).toHaveBeenCalledTimes(1);
      const dispatchedEvents = eventDispatcherMock.dispatch.mock.calls[0][0];
      expect(dispatchedEvents).toHaveLength(1);
      expect(dispatchedEvents[0]).toBeInstanceOf(ApprovalRequestApprovedEvent);
      expect(dispatchedEvents[0].requestId).toBe('req-final');
      expect(dispatchedEvents[0].tenantId).toBe('tenant-1');
      expect(dispatchedEvents[0].referenceType).toBe('StockTransfer');
      expect(dispatchedEvents[0].referenceId).toBe('transfer-99');
      expect(dispatchedEvents[0].payload).toEqual({ itemId: 'item-1', qty: 50 });
      expect(dispatchedEvents[0].occurredAt).toBeInstanceOf(Date);
    });

    it('works without eventDispatcher without throwing error', async () => {
      const serviceWithoutDispatcher = new ApprovalWorkflowService(repoMock);

      repoMock.findApprovalRequestById.mockResolvedValue({
        id: 'req-no-dispatcher',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-1',
        requesterId: 'user-1',
        status: 'PENDING',
        currentStep: 0,
        payload: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          id: 'wf-1',
          tenantId: 'tenant-1',
          name: 'PO Approval',
          triggerEvent: 'po.placed',
          isActive: true,
          config: {
            thresholds: [],
            steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        serviceWithoutDispatcher.processDecision('req-no-dispatcher', 'manager-1', 'APPROVED')
      ).resolves.toEqual({
        status: ApprovalRequestStatus.Approved,
        referenceType: 'PurchaseOrder',
        referenceId: 'po-1',
      });
    });
  });

  describe('checkExpiredRequests', () => {
    it('returns 0 when there are no stale requests', async () => {
      repoMock.findStaleRequests.mockResolvedValue([]);

      const processed = await service.checkExpiredRequests();

      expect(processed).toBe(0);
      expect(repoMock.updateApprovalRequest).not.toHaveBeenCalled();
    });

    it('skips records missing a workflow reference', async () => {
      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'stale-no-wf',
          tenantId: 'tenant-1',
          workflowId: 'wf-unknown',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-1',
          requesterId: 'user-1',
          status: 'PENDING',
          currentStep: 0,
          payload: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          workflow: undefined,
        },
      ]);

      const processed = await service.checkExpiredRequests();

      expect(processed).toBe(0);
      expect(repoMock.updateApprovalRequest).not.toHaveBeenCalled();
    });

    it('escalates stale requests to next step with updated expiresAt when next step has timeout', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'stale-step0',
          tenantId: 'tenant-1',
          workflowId: 'wf-multi',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-1',
          requesterId: 'user-1',
          status: 'PENDING',
          currentStep: 0,
          payload: {},
          expiresAt: new Date(now - 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
          workflow: {
            id: 'wf-multi',
            tenantId: 'tenant-1',
            name: 'Multi Step Approval',
            triggerEvent: 'po.placed',
            isActive: true,
            config: {
              thresholds: [],
              steps: [
                { approverRoles: ['lead'], requiredCount: 1, timeoutHours: 12 },
                { approverRoles: ['director'], requiredCount: 1, timeoutHours: 36 },
              ],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ]);

      const processed = await service.checkExpiredRequests();

      expect(processed).toBe(1);
      expect(repoMock.updateApprovalRequest).toHaveBeenCalledWith('stale-step0', {
        status: ApprovalRequestStatus.Escalated,
        currentStep: 1,
        expiresAt: new Date(now + 36 * 60 * 60 * 1000),
      });

      jest.restoreAllMocks();
    });

    it('expires stale requests if already at the final step', async () => {
      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'stale-final-step',
          tenantId: 'tenant-1',
          workflowId: 'wf-single',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-2',
          requesterId: 'user-1',
          status: 'PENDING',
          currentStep: 0,
          payload: {},
          expiresAt: new Date(Date.now() - 5000),
          createdAt: new Date(),
          updatedAt: new Date(),
          workflow: {
            id: 'wf-single',
            tenantId: 'tenant-1',
            name: 'Single Step Approval',
            triggerEvent: 'po.placed',
            isActive: true,
            config: {
              thresholds: [],
              steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ]);

      const processed = await service.checkExpiredRequests();

      expect(processed).toBe(1);
      expect(repoMock.updateApprovalRequest).toHaveBeenCalledWith('stale-final-step', {
        status: ApprovalRequestStatus.Expired,
        currentStep: 0,
        expiresAt: null,
      });
    });

    it('escalates to next step with null expiresAt if next step timeoutHours is 0', async () => {
      repoMock.findStaleRequests.mockResolvedValue([
        {
          id: 'stale-step0-no-timeout',
          tenantId: 'tenant-1',
          workflowId: 'wf-no-next-timeout',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-3',
          requesterId: 'user-1',
          status: 'PENDING',
          currentStep: 0,
          payload: {},
          expiresAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
          workflow: {
            id: 'wf-no-next-timeout',
            tenantId: 'tenant-1',
            name: 'Escalation with unlimited timeout',
            triggerEvent: 'po.placed',
            isActive: true,
            config: {
              thresholds: [],
              steps: [
                { approverRoles: ['lead'], requiredCount: 1, timeoutHours: 12 },
                { approverRoles: ['admin'], requiredCount: 1, timeoutHours: 0 },
              ],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ]);

      const processed = await service.checkExpiredRequests();

      expect(processed).toBe(1);
      expect(repoMock.updateApprovalRequest).toHaveBeenCalledWith('stale-step0-no-timeout', {
        status: ApprovalRequestStatus.Escalated,
        currentStep: 1,
        expiresAt: null,
      });
    });
  });

  describe('listPendingRequests', () => {
    const mockPendingRequests: ApprovalRequestRecord[] = [
      {
        id: 'req-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-1',
        requesterId: 'user-1',
        status: 'PENDING',
        currentStep: 0,
        payload: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          id: 'wf-1',
          tenantId: 'tenant-1',
          name: 'PO Approval',
          triggerEvent: 'po.placed',
          isActive: true,
          config: {
            steps: [{ approverRoles: ['finance_manager', 'admin'] }],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        id: 'req-2',
        tenantId: 'tenant-1',
        workflowId: 'wf-2',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-2',
        requesterId: 'user-2',
        status: 'PENDING',
        currentStep: 1,
        payload: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          id: 'wf-2',
          tenantId: 'tenant-1',
          name: 'PO Approval Step 2',
          triggerEvent: 'po.placed',
          isActive: true,
          config: {
            steps: [
              { approverRoles: ['operator'] },
              { approverRoles: ['warehouse_lead'] },
            ],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        id: 'req-3-no-wf',
        tenantId: 'tenant-1',
        workflowId: 'wf-3',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-3',
        requesterId: 'user-3',
        status: 'PENDING',
        currentStep: 0,
        payload: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: undefined,
      },
      {
        id: 'req-4-invalid-step',
        tenantId: 'tenant-1',
        workflowId: 'wf-4',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-4',
        requesterId: 'user-4',
        status: 'PENDING',
        currentStep: 99,
        payload: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          id: 'wf-4',
          tenantId: 'tenant-1',
          name: 'PO Approval Invalid Step',
          triggerEvent: 'po.placed',
          isActive: true,
          config: {
            steps: [{ approverRoles: ['admin'] }],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    it('returns all pending requests if no deciderRoleIds provided or empty', async () => {
      repoMock.findPendingRequests.mockResolvedValue(mockPendingRequests);

      const res1 = await service.listPendingRequests('tenant-1');
      expect(res1).toEqual(mockPendingRequests);

      const res2 = await service.listPendingRequests('tenant-1', []);
      expect(res2).toEqual(mockPendingRequests);
    });

    it('filters requests based on matching roles for the current step and ignores invalid records', async () => {
      repoMock.findPendingRequests.mockResolvedValue(mockPendingRequests);

      const financeResults = await service.listPendingRequests('tenant-1', ['finance_manager']);
      expect(financeResults).toHaveLength(1);
      expect(financeResults[0].id).toBe('req-1');

      const warehouseResults = await service.listPendingRequests('tenant-1', ['warehouse_lead']);
      expect(warehouseResults).toHaveLength(1);
      expect(warehouseResults[0].id).toBe('req-2');

      const adminResults = await service.listPendingRequests('tenant-1', ['admin']);
      expect(adminResults).toHaveLength(1);
      expect(adminResults[0].id).toBe('req-1');

      const unmatchedResults = await service.listPendingRequests('tenant-1', ['unrelated_role']);
      expect(unmatchedResults).toHaveLength(0);
    });
  });
});
