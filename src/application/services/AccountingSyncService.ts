import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

// -----------------------------------------------------------------------------
// Integration Mock Clients
// -----------------------------------------------------------------------------

export class NetSuiteJournalSync {
  constructor(private readonly accountId: string, private readonly token: string) {}

  async createJournalEntry(description: string, referenceId: string | null, lines: any[]): Promise<string> {
    if (!this.accountId || this.accountId.includes('mock') || !this.token || this.token.includes('mock')) {
      return `mock-netsuite-journal-${crypto.randomUUID().substring(0, 8)}`;
    }
    return `ns-journal-${crypto.randomUUID().substring(0, 8)}`;
  }
}

export class XeroJournalSync {
  constructor(private readonly tenantId: string, private readonly accessToken: string) {}

  async createManualJournal(description: string, referenceId: string | null, lines: any[]): Promise<string> {
    if (!this.tenantId || this.tenantId.includes('mock') || !this.accessToken || this.accessToken.includes('mock')) {
      return `mock-xero-journal-${crypto.randomUUID().substring(0, 8)}`;
    }
    return `xero-journal-${crypto.randomUUID().substring(0, 8)}`;
  }
}

export class QuickBooksJournalSync {
  constructor(private readonly realmId: string, private readonly accessToken: string) {}

  async createJournalEntry(description: string, referenceId: string | null, lines: any[]): Promise<string> {
    if (!this.realmId || this.realmId.includes('mock') || !this.accessToken || this.accessToken.includes('mock')) {
      return `mock-qbo-journal-${crypto.randomUUID().substring(0, 8)}`;
    }
    return `qbo-journal-${crypto.randomUUID().substring(0, 8)}`;
  }
}

// -----------------------------------------------------------------------------
// Prisma Mapping Repositories
// -----------------------------------------------------------------------------

export class NetSuiteMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveMapping(journalEntryId: string, netsuiteJournalId: string): Promise<void> {
    await this.prisma.netsuiteJournalMapping.upsert({
      where: { journalEntryId },
      create: {
        id: crypto.randomUUID(),
        journalEntryId,
        netsuiteJournalId
      },
      update: {
        netsuiteJournalId
      }
    });
  }

  async findNetSuiteJournalId(journalEntryId: string): Promise<string | null> {
    const mapping = await this.prisma.netsuiteJournalMapping.findUnique({
      where: { journalEntryId }
    });
    return mapping ? mapping.netsuiteJournalId : null;
  }
}

export class XeroMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveMapping(journalEntryId: string, xeroJournalId: string): Promise<void> {
    await this.prisma.xeroJournalMapping.upsert({
      where: { journalEntryId },
      create: {
        id: crypto.randomUUID(),
        journalEntryId,
        xeroJournalId
      },
      update: {
        xeroJournalId
      }
    });
  }

  async findXeroJournalId(journalEntryId: string): Promise<string | null> {
    const mapping = await this.prisma.xeroJournalMapping.findUnique({
      where: { journalEntryId }
    });
    return mapping ? mapping.xeroJournalId : null;
  }
}

export class QuickBooksMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveMapping(journalEntryId: string, quickbooksJournalId: string): Promise<void> {
    await this.prisma.quickbooksJournalMapping.upsert({
      where: { journalEntryId },
      create: {
        id: crypto.randomUUID(),
        journalEntryId,
        quickbooksJournalId
      },
      update: {
        quickbooksJournalId
      }
    });
  }

  async findQuickBooksJournalId(journalEntryId: string): Promise<string | null> {
    const mapping = await this.prisma.quickbooksJournalMapping.findUnique({
      where: { journalEntryId }
    });
    return mapping ? mapping.quickbooksJournalId : null;
  }
}
