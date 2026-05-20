import { SerializedItem } from '../entities/SerializedItem';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { TenantId } from '../valueObjects/TenantId';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerializedItemStatus } from '../enums/SerializedItemStatus';

export interface ISerializedItemRepository {
  save(item: SerializedItem): Promise<void>;
  findBySerial(serialNumber: SerialNumber, tenantId: TenantId): Promise<SerializedItem | null>;
  isRegistered(serialNumber: SerialNumber, tenantId: TenantId): Promise<boolean>;
  countByStatus(variantId: ProductVariantId, status: SerializedItemStatus): Promise<number>;
}
