import { ManageApprovalWorkflowsUseCase } from '../../../src/application/useCases/ManageApprovalWorkflows';
import { PrismaClient } from '@prisma/client';
import { ApprovalWorkflowService } from '../../../src/domain/services/ApprovalWorkflowService';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        approvalWorkflow: {
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn()
        },
        approvalRequest: {
          findUnique: jest.fn()
        }
      };
    })
  };
});

jest.mock('../../../src/domain/services/ApprovalWorkflowService');

describe('ManageApprovalWorkflowsUseCase', () => {
  let useCase: ManageApprovalWorkflowsUseCase;
  let prismaMock: any;
  let workflowServiceMock: jest.Mocked<ApprovalWorkflowService>;

  beforeEach(() => {
    prismaMock = new PrismaClient();
    workflowServiceMock = new ApprovalWorkflowService(prismaMock) as jest.Mocked<ApprovalWorkflowService>;
    useCase = new ManageApprovalWorkflowsUseCase(prismaMock, workflowServiceMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWorkflow', () => {
    it('should create a workflow if config has steps', async () => {
      const config = { steps: [{ roleId: 'manager' }] };
      prismaMock.approvalWorkflow.create.mockResolvedValue({
        id: 'wf1',
        tenantId: 't1',
        name: 'PO Approval',
        triggerEvent: 'PurchaseOrderCreated',
        isActive: true,
        config
      });

      const result = await useCase.createWorkflow('t1', 'PO Approval', 'PurchaseOrderCreated', config as any);

      expect(prismaMock.approvalWorkflow.create).toHaveBeenCalled();
      expect(result.id).toBe('wf1');
    });

    it('should throw an error if config has no steps', async () => {
      await expect(useCase.createWorkflow('t1', 'PO Approval', 'PurchaseOrderCreated', { steps: [] } as any))
        .rejects.toThrow(/must define at least one approval step/);
    });
  });

  describe('toggleWorkflow', () => {
    it('should toggle workflow isActive status', async () => {
      prismaMock.approvalWorkflow.update.mockResolvedValue({
        id: 'wf1',
        isActive: false
      });

      const result = await useCase.toggleWorkflow('wf1', false);

      expect(prismaMock.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: 'wf1' },
        data: { isActive: false }
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('submitDecision', () => {
    it('should delegate decision processing to workflowService', async () => {
      workflowServiceMock.processDecision.mockResolvedValue({
        status: 'APPROVED',
        deferredAction: null
      } as any);

      const result = await useCase.submitDecision('req1', 'u1', 'APPROVED', 'Looks good');

      expect(workflowServiceMock.processDecision).toHaveBeenCalledWith('req1', 'u1', 'APPROVED', 'Looks good');
      expect(result.status).toBe('APPROVED');
    });
  });
});
