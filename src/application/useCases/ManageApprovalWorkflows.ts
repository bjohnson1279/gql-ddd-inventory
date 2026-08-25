/**
 * ManageApprovalWorkflows Use Cases
 *
 * CRUD for approval workflows and decision processing.
 */
import { PrismaClient } from '@prisma/client';
import { ApprovalWorkflowService } from '../../domain/services/ApprovalWorkflowService';
import { ApprovalWorkflowConfig } from '../../domain/entities/ApprovalWorkflow';

export class ManageApprovalWorkflowsUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly workflowService: ApprovalWorkflowService
  ) {}

  /**
   * Creates a new approval workflow for a tenant.
   */
  async createWorkflow(tenantId: string, name: string, triggerEvent: string, config: ApprovalWorkflowConfig) {
    // Validate config has at least one step
    if (!config.steps || config.steps.length === 0) {
      throw new Error('Workflow must define at least one approval step.');
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        tenantId,
        name,
        triggerEvent,
        isActive: true,
        config: config as any,
      }
    });

    return workflow;
  }

  /**
   * Updates an existing workflow's configuration.
   */
  async updateWorkflow(workflowId: string, config: ApprovalWorkflowConfig) {
    if (!config.steps || config.steps.length === 0) {
      throw new Error('Workflow must define at least one approval step.');
    }

    return this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: { config: config as any }
    });
  }

  /**
   * Toggles a workflow active/inactive.
   */
  async toggleWorkflow(workflowId: string, isActive: boolean) {
    return this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: { isActive }
    });
  }

  /**
   * Lists all workflows for a tenant.
   */
  async listWorkflows(tenantId: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Gets a single approval request with its workflow and decision history.
   */
  async getApprovalRequest(requestId: string) {
    return this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        workflow: true,
        decisions: {
          orderBy: { decidedAt: 'asc' }
        }
      }
    });
  }

  /**
   * Lists pending approval requests for a tenant, optionally filtered by decider's roles.
   */
  async listPendingRequests(tenantId: string, deciderRoleIds?: string[]) {
    return this.workflowService.listPendingRequests(tenantId, deciderRoleIds);
  }

  /**
   * Submits an approval or rejection decision.
   * Returns the resulting status and the referenced entity info for downstream execution.
   */
  async submitDecision(requestId: string, deciderId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    const result = await this.workflowService.processDecision(requestId, deciderId, decision, notes);

    // If the request was fully approved, the caller should trigger the deferred action
    // (e.g., place the PO). This is handled by the resolver/controller layer.
    return result;
  }
}
