import { BarcodeRegistry } from './BarcodeRegistry';
import { Barcode } from '../valueObjects/Barcode';
import { BarcodeSymbology } from '../enums/BarcodeEnums';
import { Sku } from '../valueObjects/Sku';
import { TenantId } from '../valueObjects/TenantId';
import * as crypto from 'crypto';

export class InternalBarcodeGenerator {
  private static readonly PREFIX = 'INV';

  constructor(private readonly registry: BarcodeRegistry) {}

  async generate(sku: Sku, tenantId: TenantId): Promise<Barcode> {
    let attempts = 0;
    let value = '';

    do {
      value = this.buildValue(sku, tenantId, attempts);
      attempts++;

      if (attempts > 5) {
        throw new Error('Could not generate a unique barcode after 5 attempts.');
      }
    } while (await this.registry.isRegistered(value));

    return new Barcode(BarcodeSymbology.CODE_128, value);
  }

  private buildValue(sku: Sku, tenantId: TenantId, salt: number): string {
    const tenantHash = crypto.createHash('sha256').update(tenantId.value).digest('hex');
    const skuHash = crypto.createHash('sha256').update(sku.value + salt).digest('hex');

    const tenantFragment = tenantHash.substring(0, 4).toUpperCase();
    const skuFragment = skuHash.substring(0, 8).toUpperCase();

    return `${InternalBarcodeGenerator.PREFIX}-${tenantFragment}-${skuFragment}`;
  }
}
