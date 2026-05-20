export class ConversionRuleId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("ConversionRuleId cannot be empty.");
    }
  }

  equals(other: ConversionRuleId): boolean {
    return this.value === other.value;
  }
}
