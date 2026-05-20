export class TenantId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("TenantId cannot be empty.");
    }
  }

  equals(other: TenantId): boolean {
    return this.value === other.value;
  }
}
