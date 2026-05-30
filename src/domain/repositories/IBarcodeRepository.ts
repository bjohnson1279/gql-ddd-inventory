import { Sku } from '../valueObjects/Sku';
import { VariantBarcodeSet } from '../entities/VariantBarcodeSet';

export interface IBarcodeRepository {
  findSkuByBarcodeValue(value: string): Promise<Sku | null>;
  findSetBySku(sku: Sku): Promise<VariantBarcodeSet | null>;
  save(set: VariantBarcodeSet): Promise<void>;
}
