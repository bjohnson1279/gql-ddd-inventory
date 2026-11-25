export class SerialNumber {
  public readonly value: string;

  constructor(raw: string) {
    const normalized = raw.trim();

    if (!normalized) {
      throw new Error('Serial number cannot be empty.');
    }

    if (normalized.length > 100) {
      throw new Error('Serial number cannot exceed 100 characters.');
    }

    if (!/^[A-Za-z0-9\-\.\/]+$/.test(normalized)) {
      throw new Error(`Serial number contains invalid characters: ${normalized}`);
    }

    this.value = normalized;
  }

  equals(other: SerialNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
