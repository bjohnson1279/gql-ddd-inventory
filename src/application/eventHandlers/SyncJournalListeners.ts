import { JournalEntryCreatedEvent } from '../../domain/events/JournalEntryCreatedEvent';
import {
  NetSuiteJournalSync,
  XeroJournalSync,
  QuickBooksJournalSync,
  NetSuiteMappingRepository,
  XeroMappingRepository,
  QuickBooksMappingRepository
} from '../services/AccountingSyncService';

export class SyncJournalListeners {
  constructor(
    private readonly netsuiteSync: NetSuiteJournalSync,
    private readonly netsuiteMappings: NetSuiteMappingRepository,
    private readonly xeroSync: XeroJournalSync,
    private readonly xeroMappings: XeroMappingRepository,
    private readonly quickbooksSync: QuickBooksJournalSync,
    private readonly quickbooksMappings: QuickBooksMappingRepository
  ) {}

  async handle(event: JournalEntryCreatedEvent): Promise<void> {
    const journalEntryId = event.id;

    // 1. NetSuite Sync
    try {
      const existingNsId = await this.netsuiteMappings.findNetSuiteJournalId(journalEntryId);
      if (!existingNsId) {
        const nsId = await this.netsuiteSync.createJournalEntry(
          event.description,
          event.referenceId,
          event.lines
        );
        await this.netsuiteMappings.saveMapping(journalEntryId, nsId);
        console.log(`[NetSuite Sync] Successfully mapped local journal ${journalEntryId} -> NetSuite ${nsId}`);
      }
    } catch (err: any) {
      console.error(`[NetSuite Sync] Failed for journal ${journalEntryId}:`, err);
    }

    // 2. Xero Sync
    try {
      const existingXeroId = await this.xeroMappings.findXeroJournalId(journalEntryId);
      if (!existingXeroId) {
        const xeroId = await this.xeroSync.createManualJournal(
          event.description,
          event.referenceId,
          event.lines
        );
        await this.xeroMappings.saveMapping(journalEntryId, xeroId);
        console.log(`[Xero Sync] Successfully mapped local journal ${journalEntryId} -> Xero ${xeroId}`);
      }
    } catch (err: any) {
      console.error(`[Xero Sync] Failed for journal ${journalEntryId}:`, err);
    }

    // 3. QuickBooks Sync
    try {
      const existingQbId = await this.quickbooksMappings.findQuickBooksJournalId(journalEntryId);
      if (!existingQbId) {
        const qbId = await this.quickbooksSync.createJournalEntry(
          event.description,
          event.referenceId,
          event.lines
        );
        await this.quickbooksMappings.saveMapping(journalEntryId, qbId);
        console.log(`[QuickBooks Sync] Successfully mapped local journal ${journalEntryId} -> QuickBooks ${qbId}`);
      }
    } catch (err: any) {
      console.error(`[QuickBooks Sync] Failed for journal ${journalEntryId}:`, err);
    }
  }
}
