import crypto from 'crypto';
import { StockOnboarding } from '../entities/StockOnboarding';
import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { OpeningBalanceConflictError } from '../exceptions/DomainErrors';
import { LedgerEntry } from '../entities/LedgerEntry';
import { LedgerEntryId } from '../valueObjects/LedgerEntryId';
import { ReasonCode } from '../enums/ReasonCode';
import { ActorId } from '../valueObjects/ActorId';
import { OpeningBalancePosted } from '../events/OnboardingEvents';
import { DomainEvent } from '../events/DomainEvent';

export class OpeningBalanceService {
  constructor(
    private readonly ledgerRepository: ILedgerRepository,
    // In a real system, we'd inject an event dispatcher
    // Strongly typing the dispatcher ensures we only emit valid domain events
    private readonly eventDispatcher: (event: DomainEvent) => void = () => {}
  ) {}

  async process(onboarding: StockOnboarding, actor: ActorId): Promise<void> {
    if (!onboarding.isSubmitted) {
      throw new Error('Only submitted onboardings can be processed. Call submit() first.');
    }

    // --- Pass 1: Guard against duplicate opening balances ---
    const variantIds = onboarding.items.map(item => item.variantId);
    const hasEntriesBatch = await this.ledgerRepository.hasAnyEntriesBatch(variantIds, onboarding.locationId);

    for (const item of onboarding.items) {
      const hasEntries = hasEntriesBatch.get(item.variantId.value) || false;
      if (hasEntries) {
        throw new OpeningBalanceConflictError(item.variantId.value, onboarding.locationId.value);
      }
    }

    // --- Pass 2: Post ledger entries ---
    const entries: LedgerEntry[] = [];
    for (const item of onboarding.items) {
      const entry = new LedgerEntry(
        new LedgerEntryId(this.generateId()),
        onboarding.tenantId,
        onboarding.locationId,
        item.variantId,
        item.quantity,
        ReasonCode.OpeningBalance,
        actor,
        onboarding.asOfDate,
        onboarding.id.value,
        { unitCostCents: item.unitCostCents }
      );
      entries.push(entry);
    }

    await this.ledgerRepository.appendBatch(entries);

    for (const item of onboarding.items) {
      this.eventDispatcher(
        new OpeningBalancePosted(item.variantId.value, item.quantity, onboarding.id.value)
      );
    }
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
