export class Sku {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("SKU cannot be empty.");
    }
    
    // In a real system, you might have formatting rules, e.g., only alphanumeric
    const regex = /^[A-Z0-9-]+$/i;
    if (!regex.test(value)) {
      throw new Error("SKU must contain only alphanumeric characters and hyphens.");
    }

    this._value = value.toUpperCase();
  }

  get value(): string {
    return this._value;
  }

  equals(other: Sku): boolean {
    return this._value === other.value;
  }
}
