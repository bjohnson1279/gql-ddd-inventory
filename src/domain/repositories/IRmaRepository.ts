import { Rma } from '../entities/Rma';
import { TenantId } from '../valueObjects/TenantId';

export interface IRmaRepository {
  save(rma: Rma): Promise<void>;
  findById(id: string): Promise<Rma | null>;
  findByNumber(rmaNumber: string): Promise<Rma | null>;
  findAllByTenant(tenantId: TenantId): Promise<Rma[]>;
}
