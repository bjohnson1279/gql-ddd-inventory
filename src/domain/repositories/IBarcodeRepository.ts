import { Sku } from '../valueObjects/Sku';
import { VariantBarcodeSet } from '../entities/VariantBarcodeSet';
import { BarcodeAssignment } from '../entities/BarcodeAssignment';

export interface IBarcodeRepository {
  findSkuByBarcodeValue(value: string): Promise<Sku | null>;
  findSetBySku(sku: Sku): Promise<VariantBarcodeSet | null>;
  findAllAssignments(): Promise<BarcodeAssignment[]>;
  save(set: VariantBarcodeSet): Promise<void>;
}
