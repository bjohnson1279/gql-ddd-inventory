export class ApprovalWorkflowId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ApprovalWorkflowId cannot be empty.');
    }
  }

  equals(other: ApprovalWorkflowId): boolean {
    if (!other || !(other instanceof ApprovalWorkflowId)) {
      return false;
    }
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
