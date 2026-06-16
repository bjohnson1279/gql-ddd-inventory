import { QuarantineItem } from '../entities/QuarantineItem';
import { TenantId } from '../valueObjects/TenantId';

export interface IQuarantineRepository {
  save(item: QuarantineItem): Promise<void>;
  findById(id: string): Promise<QuarantineItem | null>;
  findAllByTenant(tenantId: TenantId): Promise<QuarantineItem[]>;
}
