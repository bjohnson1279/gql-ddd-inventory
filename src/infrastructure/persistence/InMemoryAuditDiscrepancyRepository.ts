import { IAuditDiscrepancyRepository } from '../../domain/repositories/IAuditDiscrepancyRepository';
import { AuditDiscrepancy } from '../../domain/entities/AuditDiscrepancy';

export class InMemoryAuditDiscrepancyRepository implements IAuditDiscrepancyRepository {
  private readonly items = new Map<string, AuditDiscrepancy>();

  async save(discrepancy: AuditDiscrepancy): Promise<void> {
    this.items.set(discrepancy.id, discrepancy);
  }

  async findById(id: string): Promise<AuditDiscrepancy | null> {
    return this.items.get(id) || null;
  }

  async findAll(tenantId: string, status?: string): Promise<AuditDiscrepancy[]> {
    return Array.from(this.items.values())
      .filter((item) => item.tenantId === tenantId && (!status || item.status === status))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async findOpen(tenantId: string, type: string, referenceId: string): Promise<AuditDiscrepancy | null> {
    return Array.from(this.items.values())
      .find((item) => item.tenantId === tenantId && item.type === type && item.referenceId === referenceId && item.status === 'OPEN') || null;
  }
}
