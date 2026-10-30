import { PrismaClient } from '@prisma/client';
import {
  IApprovalWorkflowRepository,
  ApprovalWorkflowRecord,
  ApprovalRequestRecord,
  ApprovalDecisionData,
} from '../../domain/repositories/IApprovalWorkflowRepository';

export class PostgresApprovalWorkflowRepository implements IApprovalWorkflowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findWorkflowByTrigger(tenantId: string, triggerEvent: string): Promise<ApprovalWorkflowRecord | null> {
    return this.prisma.approvalWorkflow.findUnique({
      where: {
        tenantId_triggerEvent: { tenantId, triggerEvent },
      },
    }) as Promise<ApprovalWorkflowRecord | null>;
  }

  async createApprovalRequest(data: {
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
  }): Promise<ApprovalRequestRecord> {
    return this.prisma.approvalRequest.create({
      data: {
        id: data.id,
        tenantId: data.tenantId,
        workflowId: data.workflowId,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        requesterId: data.requesterId,
        status: data.status,
        currentStep: data.currentStep,
        payload: data.payload,
        expiresAt: data.expiresAt,
      },
    }) as Promise<ApprovalRequestRecord>;
  }

  async findApprovalRequestById(id: string): Promise<ApprovalRequestRecord | null> {
    return this.prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        workflow: true,
        decisions: true,
      },
    }) as Promise<ApprovalRequestRecord | null>;
  }

  async saveDecisionAndUpdateRequest(
    decision: ApprovalDecisionData,
    requestId: string,
    updateData: { status: string; currentStep: number }
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.approvalDecision.create({
        data: {
          id: decision.id,
          requestId,
          stepIndex: decision.stepIndex,
          deciderId: decision.deciderId,
          decision: decision.decision,
          notes: decision.notes ?? null,
        },
      }),
      this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: updateData.status,
          currentStep: updateData.currentStep,
        },
      }),
    ]);
  }

  async findStaleRequests(now: Date): Promise<ApprovalRequestRecord[]> {
    return this.prisma.approvalRequest.findMany({
      where: {
        status: { in: ['PENDING', 'ESCALATED'] },
        expiresAt: { lte: now },
      },
      include: { workflow: true },
    }) as Promise<ApprovalRequestRecord[]>;
  }

  async updateApprovalRequest(
    requestId: string,
    updateData: { status: string; currentStep: number; expiresAt: Date | null }
  ): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: updateData.status,
        currentStep: updateData.currentStep,
        expiresAt: updateData.expiresAt,
      },
    });
  }

  async findPendingRequests(tenantId: string): Promise<ApprovalRequestRecord[]> {
    return this.prisma.approvalRequest.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'ESCALATED'] },
      },
      include: {
        workflow: true,
        decisions: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ApprovalRequestRecord[]>;
  }
}
