import { BarcodeSymbology, BarcodeSymbologyLabels } from '../enums/BarcodeEnums';

export class Barcode {
  public readonly value: string;

  constructor(
    public readonly symbology: BarcodeSymbology,
    rawValue: string
  ) {
    this.value = rawValue.trim().toUpperCase();
    this.validate();
  }

  equals(other: Barcode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  private validate(): void {
    const label = BarcodeSymbologyLabels[this.symbology];
    switch (this.symbology) {
      case BarcodeSymbology.UPC_A:
        this.validateFixedLength(12, label);
        this.validateNumeric(label);
        break;
      case BarcodeSymbology.EAN_13:
        this.validateFixedLength(13, label);
        this.validateNumeric(label);
        break;
      case BarcodeSymbology.UPC_E:
      case BarcodeSymbology.EAN_8:
        this.validateFixedLength(8, label);
        this.validateNumeric(label);
        break;
      case BarcodeSymbology.ITF_14:
        this.validateFixedLength(14, label);
        this.validateNumeric(label);
        break;
      case BarcodeSymbology.CODE_128:
      case BarcodeSymbology.GS1_128:
        this.validateAlphanumeric(label);
        break;
      case BarcodeSymbology.QR:
        // QR codes can be anything
        break;
    }
  }

  private validateFixedLength(length: number, label: string): void {
    if (this.value.length !== length) {
      throw new Error(`${label} must be exactly ${length} digits: ${this.value}`);
    }
  }

  private validateNumeric(label: string): void {
    if (!/^\d+$/.test(this.value)) {
      throw new Error(`${label} must contain only digits: ${this.value}`);
    }
  }

  private validateAlphanumeric(label: string): void {
    // Code 128 supports many characters, but we'll keep it simple for now
    if (this.value.length === 0) {
      throw new Error(`${label} cannot be empty.`);
    }
  }
}
