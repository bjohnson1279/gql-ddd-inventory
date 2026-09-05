import { ApprovalRequest, ApprovalRequestStatus, ApprovalDecisionRecord } from '../../../src/domain/entities/ApprovalRequest';

describe('ApprovalRequest Domain Entity', () => {
  const createRequest = (status = ApprovalRequestStatus.Pending, currentStep = 0) => {
    return new ApprovalRequest(
      'req-1', 'tenant-1', 'wf-1', 'PO', 'po-1', 'user-1', {}, 3,
      status, currentStep
    );
  };

  const createDecision = (stepIndex: number, decision: 'APPROVED' | 'REJECTED'): ApprovalDecisionRecord => ({
    id: 'dec-1',
    stepIndex,
    deciderId: 'user-2',
    decision,
    decidedAt: new Date()
  });

  describe('approve', () => {
    it('stays PENDING when requiredCount not met', () => {
      const req = createRequest();
      req.approve(createDecision(0, 'APPROVED'), 2);
      expect(req.status).toBe(ApprovalRequestStatus.Pending);
      expect(req.currentStep).toBe(0);
    });

    it('advances step when count met', () => {
      const req = createRequest();
      req.approve(createDecision(0, 'APPROVED'), 1);
      expect(req.status).toBe(ApprovalRequestStatus.Pending);
      expect(req.currentStep).toBe(1);
    });

    it('transitions to APPROVED at final step', () => {
      const req = createRequest(ApprovalRequestStatus.Pending, 2);
      req.approve(createDecision(2, 'APPROVED'), 1);
      expect(req.status).toBe(ApprovalRequestStatus.Approved);
      expect(req.currentStep).toBe(2);
    });

    it('throws when not PENDING', () => {
      const req = createRequest(ApprovalRequestStatus.Rejected);
      expect(() => {
        req.approve(createDecision(0, 'APPROVED'), 1);
      }).toThrow(/Cannot approve request in status: REJECTED/);
    });

    it('throws on step mismatch', () => {
      const req = createRequest();
      expect(() => {
        req.approve(createDecision(1, 'APPROVED'), 1);
      }).toThrow(/Decision step 1 does not match current step 0/);
    });
  });

  describe('reject', () => {
    it('transitions to REJECTED', () => {
      const req = createRequest();
      req.reject(createDecision(0, 'REJECTED'));
      expect(req.status).toBe(ApprovalRequestStatus.Rejected);
    });

    it('throws when not PENDING', () => {
      const req = createRequest(ApprovalRequestStatus.Approved);
      expect(() => {
        req.reject(createDecision(0, 'REJECTED'));
      }).toThrow(/Cannot reject request in status: APPROVED/);
    });
  });

  describe('escalate', () => {
    it('advances step', () => {
      const req = createRequest();
      req.escalate();
      expect(req.status).toBe(ApprovalRequestStatus.Escalated);
      expect(req.currentStep).toBe(1);
    });

    it('transitions to EXPIRED at final step', () => {
      const req = createRequest(ApprovalRequestStatus.Pending, 2);
      req.escalate();
      expect(req.status).toBe(ApprovalRequestStatus.Expired);
    });

    it('throws on terminal status', () => {
      const req = createRequest(ApprovalRequestStatus.Approved);
      expect(() => {
        req.escalate();
      }).toThrow(/Cannot escalate request in status: APPROVED/);
    });
  });

  describe('expire', () => {
    it('works on PENDING/ESCALATED', () => {
      const req1 = createRequest(ApprovalRequestStatus.Pending);
      req1.expire();
      expect(req1.status).toBe(ApprovalRequestStatus.Expired);

      const req2 = createRequest(ApprovalRequestStatus.Escalated);
      req2.expire();
      expect(req2.status).toBe(ApprovalRequestStatus.Expired);
    });

    it('throws on terminal status', () => {
      const req = createRequest(ApprovalRequestStatus.Approved);
      expect(() => {
        req.expire();
      }).toThrow(/Cannot expire request in status: APPROVED/);
    });
  });

  describe('isPending', () => {
    it('true for PENDING/ESCALATED', () => {
      expect(createRequest(ApprovalRequestStatus.Pending).isPending).toBe(true);
      expect(createRequest(ApprovalRequestStatus.Escalated).isPending).toBe(true);
      expect(createRequest(ApprovalRequestStatus.Approved).isPending).toBe(false);
      expect(createRequest(ApprovalRequestStatus.Rejected).isPending).toBe(false);
      expect(createRequest(ApprovalRequestStatus.Expired).isPending).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('creates correct state', () => {
      const expiresAt = new Date();
      const createdAt = new Date();
      const updatedAt = new Date();
      
      const req = ApprovalRequest.reconstruct(
        'req-1', 'tenant-1', 'wf-1', 'PO', 'po-1', 'user-1', { a: 1 }, 3,
        ApprovalRequestStatus.Escalated, 1, [], expiresAt, createdAt, updatedAt
      );

      expect(req.id).toBe('req-1');
      expect(req.status).toBe(ApprovalRequestStatus.Escalated);
      expect(req.currentStep).toBe(1);
      expect(req.payload).toEqual({ a: 1 });
      expect(req.expiresAt).toBe(expiresAt);
    });
  });
});
