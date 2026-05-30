import { PrismaClient } from '@prisma/client';
import { IJournalRepository } from '../../domain/repositories/IJournalRepository';
import { JournalEntry } from '../../domain/entities/JournalEntry';
import { JournalEntryId } from '../../domain/valueObjects/JournalEntryId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { AccountCode } from '../../domain/valueObjects/AccountCode';
import { AccountingMethod, DebitCredit } from '../../domain/enums/AccountingEnums';
import * as crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresJournalRepository implements IJournalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(entry: JournalEntry): Promise<void> {
    const dbId = toUuid(entry.id.value);
    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert entry
      await tx.journalEntry.upsert({
        where: { id: dbId },
        create: {
          id: dbId,
          tenantId: entry.tenantId.value,
          date: entry.date,
          description: entry.description,
          method: entry.method,
          referenceId: entry.referenceId || null,
        },
        update: {
          date: entry.date,
          description: entry.description,
          method: entry.method,
          referenceId: entry.referenceId || null,
        },
      });

      // 2. Re-create journal lines
      await tx.journalLine.deleteMany({
        where: { entryId: dbId },
      });

      if (entry.lines.length > 0) {
        await tx.journalLine.createMany({
          data: entry.lines.map((line) => ({
            entryId: dbId,
            accountCode: line.account.code,
            amountCents: line.amountCents,
            type: line.type,
            memo: line.memo || null,
          })),
        });
      }
    });
  }

  async findById(id: JournalEntryId): Promise<JournalEntry | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.journalEntry.findUnique({
      where: { id: dbId },
      include: {
        lines: true,
      },
    });

    if (!model) return null;

    const entry = new JournalEntry(
      new JournalEntryId(model.id),
      new TenantId(model.tenantId),
      model.date,
      model.description,
      model.method as AccountingMethod,
      model.referenceId || undefined
    );

    for (const l of model.lines) {
      entry.addLine(
        AccountCode.fromCode(l.accountCode),
        l.amountCents,
        l.type as DebitCredit,
        l.memo || undefined
      );
    }

    return entry;
  }

  async findAllByTenant(tenantId: TenantId): Promise<JournalEntry[]> {
    const models = await this.prisma.journalEntry.findMany({
      where: { tenantId: tenantId.value },
      include: {
        lines: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return models.map((model) => {
      const entry = new JournalEntry(
        new JournalEntryId(model.id),
        new TenantId(model.tenantId),
        model.date,
        model.description,
        model.method as AccountingMethod,
        model.referenceId || undefined
      );

      for (const l of model.lines) {
        entry.addLine(
          AccountCode.fromCode(l.accountCode),
          l.amountCents,
          l.type as DebitCredit,
          l.memo || undefined
        );
      }

      return entry;
    });
  }
}
