import { AuditDiscrepancy } from "../entities/AuditDiscrepancy";

export interface IAuditDiscrepancyRepository {
  save(discrepancy: AuditDiscrepancy): Promise<void>;
  findById(id: string): Promise<AuditDiscrepancy | null>;
  findAll(tenantId: string, status?: string): Promise<AuditDiscrepancy[]>;
  findOpen(tenantId: string, type: string, referenceId: string): Promise<AuditDiscrepancy | null>;
}
