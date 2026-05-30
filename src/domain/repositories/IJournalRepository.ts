import { JournalEntry } from '../entities/JournalEntry';
import { TenantId } from '../valueObjects/TenantId';
import { JournalEntryId } from '../valueObjects/JournalEntryId';

export interface IJournalRepository {
  save(entry: JournalEntry): Promise<void>;
  findById(id: JournalEntryId): Promise<JournalEntry | null>;
  findAllByTenant(tenantId: TenantId): Promise<JournalEntry[]>;
}
