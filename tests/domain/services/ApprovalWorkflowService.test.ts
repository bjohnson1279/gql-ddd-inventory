import { ApprovalWorkflowService } from '../../../src/domain/services/ApprovalWorkflowService';
import { PrismaClient } from '@prisma/client';
import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';
import { ApprovalRequestApprovedEvent, ApprovalRequestRejectedEvent } from '../../../src/domain/events/ApprovalEvents';
import { ApprovalRequestStatus } from '../../../src/domain/entities/ApprovalRequest';

describe('ApprovalWorkflowService', () => {
  let prismaMock: any;
  let eventDispatcherMock: jest.Mocked<DomainEventDispatcher>;
  let service: ApprovalWorkflowService;

  beforeEach(() => {
    prismaMock = {
      approvalWorkflow: {
        findUnique: jest.fn(),
      },
      approvalRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      approvalDecision: {
        create: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };
    eventDispatcherMock = {
      dispatch: jest.fn(),
    } as any;
    service = new ApprovalWorkflowService(prismaMock as unknown as PrismaClient, eventDispatcherMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateAndIntercept', () => {
    it('returns intercepted: false when no workflow exists for tenant and triggerEvent', async () => {
      prismaMock.approvalWorkflow.findUnique.mockResolvedValue(null);

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'po.create',
        'PurchaseOrder',
        'po-100',
        'user-1',
        { amount: 500 }
      );

      expect(result).toEqual({ intercepted: false });
      expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    });

    it('returns intercepted: false when workflow exists but is inactive', async () => {
      prismaMock.approvalWorkflow.findUnique.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'PO Approval',
        triggerEvent: 'po.create',
        isActive: false,
        config: {
          thresholds: [],
          steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'po.create',
        'PurchaseOrder',
        'po-100',
        'user-1',
        { amount: 500 }
      );

      expect(result).toEqual({ intercepted: false });
      expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    });

    it('returns intercepted: false when payload does not satisfy threshold conditions', async () => {
      prismaMock.approvalWorkflow.findUnique.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'High Value PO Approval',
        triggerEvent: 'po.create',
        isActive: true,
        config: {
          thresholds: [{ field: 'amount', operator: '>=', value: 1000 }],
          steps: [{ approverRoles: ['director'], requiredCount: 1, timeoutHours: 12 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'po.create',
        'PurchaseOrder',
        'po-100',
        'user-1',
        { amount: 999 }
      );

      expect(result).toEqual({ intercepted: false });
      expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    });

    it('intercepts and sets expiresAt when threshold is met and timeoutHours > 0', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      prismaMock.approvalWorkflow.findUnique.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'High Value PO Approval',
        triggerEvent: 'po.create',
        isActive: true,
        config: {
          thresholds: [{ field: 'amount', operator: '>=', value: 1000 }],
          steps: [{ approverRoles: ['director'], requiredCount: 1, timeoutHours: 24 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.evaluateAndIntercept(
        'tenant-1',
        'po.create',
        'PurchaseOrder',
        'po-100',
        'user-1',
        { amount: 1500 }
      );

      expect(result.intercepted).toBe(true);
      expect(result.requestId).toBeDefined();

      const expectedExpiresAt = new Date(now + 24 * 60 * 60 * 1000);
      expect(prismaMock.approvalRequest.create).toHaveBeenCalledWith({
        data: {
          id: result.requestId,
          tenantId: 'tenant-1',
          workflowId: 'wf-1',
          referenceType: 'PurchaseOrder',
          referenceId: 'po-100',
          requesterId: 'user-1',
          status: 'PENDING',
          currentStep: 0,
          payload: { amount: 1500 },
          expiresAt: expectedExpiresAt,
        },
      });

      jest.spyOn(Date, 'now').mockRestore();
    });

    it('sets expiresAt to null when first step timeoutHours is 0', async () => {
      prismaMock.approvalWorkflow.findUnique.mockResolvedValue({
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'No Timeout Workflow',
        triggerEvent: 'po.create',
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
        'po.create',
        'PurchaseOrder',
        'po-100',
        'user-1',
        { amount: 50 }
      );

      expect(result.intercepted).toBe(true);
      expect(prismaMock.approvalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: null,
          }),
        })
      );
    });
  });

  describe('processDecision', () => {
    it('throws error when approval request is not found', async () => {
      prismaMock.approvalRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.processDecision('non-existent-id', 'decider-1', 'APPROVED')
      ).rejects.toThrow('Approval request non-existent-id not found.');
    });

    it('rejects a request immediately and dispatches ApprovalRequestRejectedEvent', async () => {
      const mockRequestRecord = {
        id: 'req-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-100',
        requesterId: 'user-1',
        payload: { amount: 2000 },
        status: 'PENDING',
        currentStep: 0,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          config: {
            steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
          },
        },
        decisions: [],
      };

      prismaMock.approvalRequest.findUnique.mockResolvedValue(mockRequestRecord);

      const result = await service.processDecision('req-1', 'manager-1', 'REJECTED', 'Budget exceeded');

      expect(result).toEqual({
        status: ApprovalRequestStatus.Rejected,
        referenceType: 'PurchaseOrder',
        referenceId: 'po-100',
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.approvalDecision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 'req-1',
          stepIndex: 0,
          deciderId: 'manager-1',
          decision: 'REJECTED',
          notes: 'Budget exceeded',
        }),
      });
      expect(prismaMock.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: ApprovalRequestStatus.Rejected,
          currentStep: 0,
        },
      });

      expect(eventDispatcherMock.dispatch).toHaveBeenCalledWith([
        expect.any(ApprovalRequestRejectedEvent),
      ]);
      const dispatchedEvent = eventDispatcherMock.dispatch.mock.calls[0][0][0] as ApprovalRequestRejectedEvent;
      expect(dispatchedEvent.requestId).toBe('req-1');
      expect(dispatchedEvent.tenantId).toBe('tenant-1');
      expect(dispatchedEvent.referenceType).toBe('PurchaseOrder');
      expect(dispatchedEvent.referenceId).toBe('po-100');
    });

    it('advances currentStep when approved on intermediate step and does not dispatch approved event yet', async () => {
      const mockRequestRecord = {
        id: 'req-2',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-200',
        requesterId: 'user-1',
        payload: { amount: 5000 },
        status: 'PENDING',
        currentStep: 0,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          config: {
            steps: [
              { approverRoles: ['team_lead'], requiredCount: 1, timeoutHours: 12 },
              { approverRoles: ['finance_head'], requiredCount: 1, timeoutHours: 24 },
            ],
          },
        },
        decisions: [],
      };

      prismaMock.approvalRequest.findUnique.mockResolvedValue(mockRequestRecord);

      const result = await service.processDecision('req-2', 'lead-1', 'APPROVED', 'Looks good to me');

      expect(result).toEqual({
        status: ApprovalRequestStatus.Pending,
        referenceType: 'PurchaseOrder',
        referenceId: 'po-200',
      });

      expect(prismaMock.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-2' },
        data: {
          status: ApprovalRequestStatus.Pending,
          currentStep: 1,
        },
      });
      expect(eventDispatcherMock.dispatch).not.toHaveBeenCalled();
    });

    it('transitions to APPROVED on final step approval and dispatches ApprovalRequestApprovedEvent', async () => {
      const mockRequestRecord = {
        id: 'req-3',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-300',
        requesterId: 'user-1',
        payload: { amount: 5000 },
        status: 'PENDING',
        currentStep: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          config: {
            steps: [
              { approverRoles: ['team_lead'], requiredCount: 1, timeoutHours: 12 },
              { approverRoles: ['finance_head'], requiredCount: 1, timeoutHours: 24 },
            ],
          },
        },
        decisions: [
          {
            id: 'dec-1',
            stepIndex: 0,
            deciderId: 'lead-1',
            decision: 'APPROVED',
            notes: 'Approved step 1',
            decidedAt: new Date(),
          },
        ],
      };

      prismaMock.approvalRequest.findUnique.mockResolvedValue(mockRequestRecord);

      const result = await service.processDecision('req-3', 'finance-1', 'APPROVED');

      expect(result).toEqual({
        status: ApprovalRequestStatus.Approved,
        referenceType: 'PurchaseOrder',
        referenceId: 'po-300',
      });

      expect(prismaMock.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-3' },
        data: {
          status: ApprovalRequestStatus.Approved,
          currentStep: 1,
        },
      });

      expect(eventDispatcherMock.dispatch).toHaveBeenCalledWith([
        expect.any(ApprovalRequestApprovedEvent),
      ]);
      const dispatchedEvent = eventDispatcherMock.dispatch.mock.calls[0][0][0] as ApprovalRequestApprovedEvent;
      expect(dispatchedEvent.requestId).toBe('req-3');
      expect(dispatchedEvent.tenantId).toBe('tenant-1');
      expect(dispatchedEvent.referenceType).toBe('PurchaseOrder');
      expect(dispatchedEvent.referenceId).toBe('po-300');
    });

    it('works without an eventDispatcher instance without crashing', async () => {
      const serviceNoDispatcher = new ApprovalWorkflowService(prismaMock as unknown as PrismaClient);

      const mockRequestRecord = {
        id: 'req-4',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'StockTransfer',
        referenceId: 'st-10',
        requesterId: 'user-1',
        payload: {},
        status: 'PENDING',
        currentStep: 0,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        workflow: {
          config: {
            steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
          },
        },
        decisions: [],
      };

      prismaMock.approvalRequest.findUnique.mockResolvedValue(mockRequestRecord);

      const result = await serviceNoDispatcher.processDecision('req-4', 'mgr-1', 'APPROVED');
      expect(result.status).toBe(ApprovalRequestStatus.Approved);
    });
  });

  describe('checkExpiredRequests', () => {
    it('escalates stale pending requests to next step and calculates new expiresAt', async () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const staleRequest = {
        id: 'stale-1',
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
            steps: [
              { approverRoles: ['level1'], requiredCount: 1, timeoutHours: 12 },
              { approverRoles: ['level2'], requiredCount: 1, timeoutHours: 24 },
            ],
          },
        },
      };

      prismaMock.approvalRequest.findMany.mockResolvedValue([staleRequest]);

      const count = await service.checkExpiredRequests();

      expect(count).toBe(1);
      const expectedNewExpiresAt = new Date(now + 24 * 60 * 60 * 1000);
      expect(prismaMock.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'stale-1' },
        data: {
          status: ApprovalRequestStatus.Escalated,
          currentStep: 1,
          expiresAt: expectedNewExpiresAt,
        },
      });

      jest.spyOn(Date, 'now').mockRestore();
    });

    it('transitions stale request to EXPIRED when already on the final step', async () => {
      const staleRequest = {
        id: 'stale-final',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        referenceType: 'PurchaseOrder',
        referenceId: 'po-2',
        requesterId: 'user-1',
        payload: {},
        status: 'PENDING',
        currentStep: 1,
        expiresAt: new Date(Date.now() - 5000),
        workflow: {
          config: {
            steps: [
              { approverRoles: ['level1'], requiredCount: 1, timeoutHours: 12 },
              { approverRoles: ['level2'], requiredCount: 1, timeoutHours: 24 },
            ],
          },
        },
      };

      prismaMock.approvalRequest.findMany.mockResolvedValue([staleRequest]);

      const count = await service.checkExpiredRequests();

      expect(count).toBe(1);
      expect(prismaMock.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'stale-final' },
        data: {
          status: ApprovalRequestStatus.Expired,
          currentStep: 1,
          expiresAt: null,
        },
      });
    });

    it('returns 0 when there are no stale requests', async () => {
      prismaMock.approvalRequest.findMany.mockResolvedValue([]);

      const count = await service.checkExpiredRequests();

      expect(count).toBe(0);
      expect(prismaMock.approvalRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('listPendingRequests', () => {
    const mockPendingRequests = [
      {
        id: 'req-a',
        tenantId: 't-1',
        currentStep: 0,
        workflow: {
          config: {
            steps: [{ approverRoles: ['manager', 'admin'], requiredCount: 1, timeoutHours: 24 }],
          },
        },
      },
      {
        id: 'req-b',
        tenantId: 't-1',
        currentStep: 0,
        workflow: {
          config: {
            steps: [{ approverRoles: ['finance_auditor'], requiredCount: 1, timeoutHours: 24 }],
          },
        },
      },
    ];

    it('returns all pending/escalated requests when no deciderRoleIds are supplied', async () => {
      prismaMock.approvalRequest.findMany.mockResolvedValue(mockPendingRequests);

      const result = await service.listPendingRequests('t-1');

      expect(result).toHaveLength(2);
      expect(prismaMock.approvalRequest.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 't-1',
          status: { in: ['PENDING', 'ESCALATED'] },
        },
        include: {
          workflow: true,
          decisions: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters requests where the current step approverRoles match provided deciderRoleIds', async () => {
      prismaMock.approvalRequest.findMany.mockResolvedValue(mockPendingRequests);

      const result = await service.listPendingRequests('t-1', ['finance_auditor']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('req-b');
    });

    it('returns empty array when deciderRoleIds do not match any step approverRoles', async () => {
      prismaMock.approvalRequest.findMany.mockResolvedValue(mockPendingRequests);

      const result = await service.listPendingRequests('t-1', ['warehouse_operator']);

      expect(result).toHaveLength(0);
    });

    it('filters out request if currentStep index is invalid or missing in workflow config', async () => {
      const invalidStepRequest = [
        {
          id: 'req-corrupted',
          tenantId: 't-1',
          currentStep: 99,
          workflow: {
            config: {
              steps: [{ approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }],
            },
          },
        },
      ];
      prismaMock.approvalRequest.findMany.mockResolvedValue(invalidStepRequest);

      const result = await service.listPendingRequests('t-1', ['manager']);

      expect(result).toHaveLength(0);
    });
  });
});
