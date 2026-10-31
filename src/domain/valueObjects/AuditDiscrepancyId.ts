export class AuditDiscrepancyId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('AuditDiscrepancyId cannot be empty.');
    }
  }

  equals(other: AuditDiscrepancyId): boolean {
    if (!other || !(other instanceof AuditDiscrepancyId)) {
      return false;
    }
    return this.value === other.value;
  }
}
