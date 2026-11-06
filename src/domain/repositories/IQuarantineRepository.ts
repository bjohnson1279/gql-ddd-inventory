import { QuarantineItem } from '../entities/QuarantineItem';
import { TenantId } from '../valueObjects/TenantId';
import { QuarantineItemId } from '../valueObjects/QuarantineItemId';

export interface IQuarantineRepository {
  save(item: QuarantineItem): Promise<void>;
  saveBatch(items: QuarantineItem[]): Promise<void>;
  findById(id: QuarantineItemId | string): Promise<QuarantineItem | null>;
  findAllByTenant(tenantId: TenantId): Promise<QuarantineItem[]>;
}
