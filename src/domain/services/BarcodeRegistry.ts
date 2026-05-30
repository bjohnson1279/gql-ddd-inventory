import { IBarcodeRepository } from '../repositories/IBarcodeRepository';
import { Sku } from '../valueObjects/Sku';

export class BarcodeRegistry {
  constructor(private readonly repository: IBarcodeRepository) {}

  async resolve(scannedValue: string): Promise<Sku> {
    const sku = await this.repository.findSkuByBarcodeValue(scannedValue.trim().toUpperCase());
    if (!sku) {
      throw new Error(`No variant found for barcode: ${scannedValue}`);
    }
    return sku;
  }

  async isRegistered(value: string): Promise<boolean> {
    const sku = await this.repository.findSkuByBarcodeValue(value.trim().toUpperCase());
    return sku !== null;
  }
}
