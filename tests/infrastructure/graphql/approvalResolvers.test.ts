import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { ManageApprovalWorkflowsUseCase } from '../../../src/application/useCases/ManageApprovalWorkflows';

jest.mock('../../../src/application/useCases/ManageApprovalWorkflows');

describe('Approval Resolvers', () => {
  const mockContext = {
    auth: {
      tenantId: 't-1',
      actorId: 'admin-1',
      role: 'admin',
      permissions: ['approval:configure', 'approval:approve']
    },
    prisma: {} as any
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mutation.createApprovalWorkflow', () => {
    it('should create an approval workflow', async () => {
      const mockWorkflow = { id: 'w-1', name: 'Test Workflow', triggerEvent: 'PO_CREATED', isActive: true, config: { steps: [{ name: 'Step 1' }] } };
      (ManageApprovalWorkflowsUseCase.prototype.createWorkflow as jest.Mock).mockResolvedValue(mockWorkflow);

      const result = await (resolvers.Mutation as any).createApprovalWorkflow(
        null,
        { tenantId: 't-1', name: 'Test Workflow', triggerEvent: 'PO_CREATED', config: { steps: [{ name: 'Step 1' }] } },
        mockContext
      );

      expect(ManageApprovalWorkflowsUseCase.prototype.createWorkflow).toHaveBeenCalledWith('t-1', 'Test Workflow', 'PO_CREATED', { steps: [{ name: 'Step 1' }] });
      expect(result).toEqual(mockWorkflow);
    });

    it('should throw forbidden if no permissions', async () => {
      const forbiddenContext = {
        auth: { tenantId: 't-1', actorId: 'user-1', role: 'viewer', permissions: [] },
        prisma: {} as any
      };

      await expect((resolvers.Mutation as any).createApprovalWorkflow(
        null,
        { tenantId: 't-1', name: 'Test Workflow', triggerEvent: 'PO_CREATED', config: { steps: [{ name: 'Step 1' }] } },
        forbiddenContext
      )).rejects.toThrow(/Forbidden/);
    });
  });

  describe('Mutation.submitApprovalDecision', () => {
    it('should submit an approval decision and return the result', async () => {
      const mockResult = { status: 'APPROVED', referenceType: 'PurchaseOrder', referenceId: 'po-1' };
      (ManageApprovalWorkflowsUseCase.prototype.submitDecision as jest.Mock).mockResolvedValue(mockResult);

      const pubsub = require('../../../src/infrastructure/graphql/pubsub').pubsub;
      jest.spyOn(pubsub, 'publish').mockImplementation(() => {});

      const result = await (resolvers.Mutation as any).submitApprovalDecision(
        null,
        { requestId: 'r-1', decision: 'APPROVED', notes: 'Looks good' },
        mockContext
      );

      expect(ManageApprovalWorkflowsUseCase.prototype.submitDecision).toHaveBeenCalledWith('r-1', 'admin-1', 'APPROVED', 'Looks good');
      expect(pubsub.publish).toHaveBeenCalledWith('PO_APPROVED', { referenceId: 'po-1' });
      expect(result).toEqual(mockResult);
    });

    it('should throw forbidden if no permissions', async () => {
      const forbiddenContext = {
        auth: { tenantId: 't-1', actorId: 'user-1', role: 'viewer', permissions: [] },
        prisma: {} as any
      };

      await expect((resolvers.Mutation as any).submitApprovalDecision(
        null,
        { requestId: 'r-1', decision: 'APPROVED', notes: 'Looks good' },
        forbiddenContext
      )).rejects.toThrow(/Forbidden/);
    });
  });
});
