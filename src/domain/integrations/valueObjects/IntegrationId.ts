export class IntegrationId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("IntegrationId cannot be empty.");
    }
  }

  equals(other: IntegrationId): boolean {
    return this.value === other.value;
  }
}
