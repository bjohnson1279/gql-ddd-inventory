import { SerializedItem } from '../entities/SerializedItem';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { TenantId } from '../valueObjects/TenantId';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerializedItemStatus } from '../enums/SerializedItemStatus';

export interface ISerializedItemRepository {
  save(item: SerializedItem): Promise<void>;
  saveBatch(items: SerializedItem[]): Promise<void>;
  findBySerial(serialNumber: SerialNumber, tenantId: TenantId): Promise<SerializedItem | null>;
  findBySerialAndVariant(serialNumber: SerialNumber, variantId: ProductVariantId): Promise<SerializedItem | null>;
  findManyBySerialsAndVariant(serialNumbers: SerialNumber[], variantId: ProductVariantId): Promise<SerializedItem[]>;
  findByVariantId(variantId: ProductVariantId, tenantId: TenantId): Promise<SerializedItem[]>;
  isRegistered(serialNumber: SerialNumber, tenantId: TenantId): Promise<boolean>;
  countByStatus(variantId: ProductVariantId, status: SerializedItemStatus): Promise<number>;
  countAllStatuses(variantId: ProductVariantId): Promise<Record<SerializedItemStatus, number>>;
}
