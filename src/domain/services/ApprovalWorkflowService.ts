/**
 * ApprovalWorkflowService
 *
 * Orchestration service that:
 * 1. Evaluates whether a domain action should be intercepted by an approval workflow
 * 2. Creates approval requests when thresholds are met
 * 3. Processes approval/rejection decisions and advances the workflow
 * 4. Handles escalation and expiration of stale requests
 */
import { PrismaClient } from '@prisma/client';
import { ApprovalWorkflow, ApprovalWorkflowConfig } from '../entities/ApprovalWorkflow';
import { ApprovalRequest, ApprovalRequestStatus, ApprovalDecisionRecord } from '../entities/ApprovalRequest';
import crypto from 'node:crypto';

export interface InterceptResult {
  /** Whether the action was intercepted and requires approval */
  intercepted: boolean;
  /** The approval request ID, if intercepted */
  requestId?: string;
}

import { DomainEventDispatcher } from '../../application/services/DomainEventDispatcher';
import { ApprovalRequestApprovedEvent, ApprovalRequestRejectedEvent } from '../events/ApprovalEvents';

export class ApprovalWorkflowService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventDispatcher?: DomainEventDispatcher
  ) {}

  /**
   * Evaluates whether a domain action should be intercepted.
   * If a matching active workflow exists and thresholds are met,
   * creates an ApprovalRequest and returns { intercepted: true }.
   */
  async evaluateAndIntercept(
    tenantId: string,
    triggerEvent: string,
    referenceType: string,
    referenceId: string,
    requesterId: string,
    payload: Record<string, any>
  ): Promise<InterceptResult> {
    // Look up active workflow for this tenant + trigger event
    const workflowRecord = await this.prisma.approvalWorkflow.findUnique({
      where: {
        tenantId_triggerEvent: { tenantId, triggerEvent }
      }
    });

    if (!workflowRecord || !workflowRecord.isActive) {
      return { intercepted: false };
    }

    const config = workflowRecord.config as unknown as ApprovalWorkflowConfig;
    const workflow = new ApprovalWorkflow(
      workflowRecord.id,
      workflowRecord.tenantId,
      workflowRecord.name,
      workflowRecord.triggerEvent,
      workflowRecord.isActive,
      config,
      workflowRecord.createdAt,
      workflowRecord.updatedAt
    );

    if (!workflow.shouldTrigger(payload)) {
      return { intercepted: false };
    }

    // Calculate expiration based on first step timeout
    const firstStep = workflow.getStep(0);
    const expiresAt = firstStep && firstStep.timeoutHours > 0
      ? new Date(Date.now() + firstStep.timeoutHours * 60 * 60 * 1000)
      : null;

    // Create the approval request
    const requestId = crypto.randomUUID();
    await this.prisma.approvalRequest.create({
      data: {
        id: requestId,
        tenantId,
        workflowId: workflowRecord.id,
        referenceType,
        referenceId,
        requesterId,
        status: 'PENDING',
        currentStep: 0,
        payload: payload as any,
        expiresAt,
      }
    });

    return { intercepted: true, requestId };
  }

  /**
   * Processes an approve or reject decision on a pending request.
   * Returns the updated request status.
   */
  async processDecision(
    requestId: string,
    deciderId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ): Promise<{ status: ApprovalRequestStatus; referenceType: string; referenceId: string }> {
    // Load the request and its workflow
    const requestRecord = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        workflow: true,
        decisions: true,
      }
    });

    if (!requestRecord) {
      throw new Error(`Approval request ${requestId} not found.`);
    }

    const config = requestRecord.workflow.config as unknown as ApprovalWorkflowConfig;
    const existingDecisions: ApprovalDecisionRecord[] = requestRecord.decisions.map(d => ({
      id: d.id,
      stepIndex: d.stepIndex,
      deciderId: d.deciderId,
      decision: d.decision as 'APPROVED' | 'REJECTED',
      notes: d.notes ?? undefined,
      decidedAt: d.decidedAt,
    }));

    const request = ApprovalRequest.reconstruct(
      requestRecord.id,
      requestRecord.tenantId,
      requestRecord.workflowId,
      requestRecord.referenceType,
      requestRecord.referenceId,
      requestRecord.requesterId,
      requestRecord.payload as Record<string, any>,
      config.steps.length,
      requestRecord.status as ApprovalRequestStatus,
      requestRecord.currentStep,
      existingDecisions,
      requestRecord.expiresAt ?? undefined,
      requestRecord.createdAt,
      requestRecord.updatedAt
    );

    const decisionId = crypto.randomUUID();
    const decisionRecord: ApprovalDecisionRecord = {
      id: decisionId,
      stepIndex: request.currentStep,
      deciderId,
      decision,
      notes,
      decidedAt: new Date(),
    };

    if (decision === 'REJECTED') {
      request.reject(decisionRecord);
    } else {
      const currentStepConfig = config.steps[request.currentStep];
      request.approve(decisionRecord, currentStepConfig?.requiredCount ?? 1);
    }

    // Persist the decision and update the request
    await this.prisma.$transaction([
      this.prisma.approvalDecision.create({
        data: {
          id: decisionId,
          requestId,
          stepIndex: decisionRecord.stepIndex,
          deciderId,
          decision,
          notes: notes ?? null,
        }
      }),
      this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: request.status,
          currentStep: request.currentStep,
        }
      })
    ]);

    if (this.eventDispatcher) {
      if (request.status === ApprovalRequestStatus.Approved) {
        this.eventDispatcher.dispatch([
          new ApprovalRequestApprovedEvent(
            request.id,
            request.tenantId,
            request.referenceType,
            request.referenceId,
            request.payload
          )
        ]);
      } else if (request.status === ApprovalRequestStatus.Rejected) {
        this.eventDispatcher.dispatch([
          new ApprovalRequestRejectedEvent(
            request.id,
            request.tenantId,
            request.referenceType,
            request.referenceId,
            request.payload
          )
        ]);
      }
    }

    return {
      status: request.status,
      referenceType: request.referenceType,
      referenceId: request.referenceId,
    };
  }

  /**
   * Checks for expired/stale approval requests and escalates or expires them.
   * Intended to be called by a cron worker.
   */
  async checkExpiredRequests(): Promise<number> {
    const now = new Date();
    const staleRequests = await this.prisma.approvalRequest.findMany({
      where: {
        status: { in: ['PENDING', 'ESCALATED'] },
        expiresAt: { lte: now },
      },
      include: { workflow: true }
    });

    let processedCount = 0;

    for (const record of staleRequests) {
      const config = record.workflow.config as unknown as ApprovalWorkflowConfig;
      const request = ApprovalRequest.reconstruct(
        record.id, record.tenantId, record.workflowId,
        record.referenceType, record.referenceId, record.requesterId,
        record.payload as Record<string, any>,
        config.steps.length,
        record.status as ApprovalRequestStatus,
        record.currentStep,
        [], // decisions not needed for escalation
        record.expiresAt ?? undefined
      );

      request.escalate();

      // Compute new expiration if escalated to next step
      let newExpiresAt: Date | null = null;
      if (request.isPending) {
        const nextStep = config.steps[request.currentStep];
        if (nextStep && nextStep.timeoutHours > 0) {
          newExpiresAt = new Date(Date.now() + nextStep.timeoutHours * 60 * 60 * 1000);
        }
      }

      await this.prisma.approvalRequest.update({
        where: { id: record.id },
        data: {
          status: request.status,
          currentStep: request.currentStep,
          expiresAt: newExpiresAt,
        }
      });

      processedCount++;
    }

    return processedCount;
  }

  /**
   * Lists pending approval requests for a given tenant, optionally filtered
   * to requests where the decider's roles match the current step's approver roles.
   */
  async listPendingRequests(
    tenantId: string,
    deciderRoleIds?: string[]
  ): Promise<any[]> {
    const requests = await this.prisma.approvalRequest.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'ESCALATED'] },
      },
      include: {
        workflow: true,
        decisions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!deciderRoleIds || deciderRoleIds.length === 0) {
      return requests;
    }

    // Filter to requests where current step's approverRoles overlap with decider's roles
    return requests.filter(req => {
      const config = req.workflow.config as any as ApprovalWorkflowConfig;
      const currentStep = config.steps[req.currentStep];
      if (!currentStep) return false;
      return currentStep.approverRoles.some(role => deciderRoleIds.includes(role));
    });
  }
}
