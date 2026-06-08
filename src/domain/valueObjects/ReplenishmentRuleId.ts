export class ReplenishmentRuleId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("ReplenishmentRuleId cannot be empty.");
    }
  }

  equals(other: ReplenishmentRuleId): boolean {
    return this.value === other.value;
  }
}
