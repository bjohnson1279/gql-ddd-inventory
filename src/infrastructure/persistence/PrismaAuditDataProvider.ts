import { PrismaClient } from '@prisma/client';
import { AuditDataProvider } from '../../domain/services/AuditProcessorService';

export class PrismaAuditDataProvider implements AuditDataProvider {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveIntegrationConnections(tenantId: string): Promise<any[]> {
    return this.prisma.integrationConnection.findMany({
      where: { tenantId, isActive: true }
    });
  }

  async findExternalMappings(tenantId: string, entityType: string): Promise<any[]> {
    return this.prisma.externalMapping.findMany({
      where: { tenantId, entityType }
    });
  }

  async findProductVariants(variantIds: string[]): Promise<any[]> {
    return this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } }
    });
  }

  async getLedgerSums(tenantId: string, variantIds: string[], locationIds: string[]): Promise<Array<{ variantId: string; locationId: string; sumQuantity: number }>> {
    const ledgerSums = await this.prisma.ledgerEntry.groupBy({
      by: ['variantId', 'locationId'],
      where: {
        tenantId,
        variantId: { in: variantIds },
        locationId: { in: locationIds }
      },
      _sum: { quantity: true }
    });
    return ledgerSums.map((s) => ({
      variantId: s.variantId,
      locationId: s.locationId,
      sumQuantity: s._sum.quantity || 0
    }));
  }

  async findOpenAuditDiscrepancies(tenantId: string, type: string): Promise<any[]> {
    return this.prisma.auditDiscrepancy.findMany({
      where: { tenantId, type, status: 'OPEN' }
    });
  }

  async createAuditDiscrepancies(discrepancies: any[]): Promise<void> {
    await this.prisma.auditDiscrepancy.createMany({
      data: discrepancies
    });
  }

  async findRecentJournalEntries(tenantId: string, since: Date): Promise<any[]> {
    return this.prisma.journalEntry.findMany({
      where: { tenantId, createdAt: { gte: since } }
    });
  }

  async findQuickbooksJournalMappings(journalIds: string[]): Promise<any[]> {
    return this.prisma.quickbooksJournalMapping.findMany({
      where: { journalEntryId: { in: journalIds } }
    });
  }

  async findXeroJournalMappings(journalIds: string[]): Promise<any[]> {
    return this.prisma.xeroJournalMapping.findMany({
      where: { journalEntryId: { in: journalIds } }
    });
  }

  async findNetsuiteJournalMappings(journalIds: string[]): Promise<any[]> {
    return this.prisma.netsuiteJournalMapping.findMany({
      where: { journalEntryId: { in: journalIds } }
    });
  }

  async findAuditDiscrepancyById(tenantId: string, id: string): Promise<any | null> {
    return this.prisma.auditDiscrepancy.findFirst({
      where: { id, tenantId }
    });
  }

  async resolveAuditDiscrepancyAndCreateOutboxEvent(
    tenantId: string,
    id: string,
    notes: string,
    outboxEvent: any
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.auditDiscrepancy.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionNotes: notes
        }
      });

      if (outboxEvent) {
        await tx.outboxEvent.create({
          data: outboxEvent
        });
      }
    });
  }
}
