import { ApprovalWorkflowService } from '../../../src/domain/services/ApprovalWorkflowService';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        approvalWorkflow: {
          findUnique: jest.fn()
        },
        approvalRequest: {
          create: jest.fn()
        }
      };
    })
  };
});

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = new PrismaClient();
    service = new ApprovalWorkflowService(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not intercept if no workflow exists for the trigger event', async () => {
    prismaMock.approvalWorkflow.findUnique.mockResolvedValue(null);

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
    expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
  });

  it('should intercept if active workflow exists', async () => {
    prismaMock.approvalWorkflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      tenantId: 'tenant-1',
      triggerEvent: 'purchase_order.place',
      isActive: true,
      config: { thresholds: [], steps: [{ roleId: 'finance_auditor', minApprovals: 1, timeoutHours: 24 }] }
    });

    prismaMock.approvalRequest.create.mockResolvedValue({
      id: 'req-1',
      workflowId: 'wf-1',
      status: 'PENDING',
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
    expect(prismaMock.approvalRequest.create).toHaveBeenCalled();
  });
});
