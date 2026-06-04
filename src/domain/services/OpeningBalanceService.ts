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
    private readonly eventDispatcher: (event: DomainEvent) => void = () => {}
  ) {}

  async process(onboarding: StockOnboarding, actor: ActorId): Promise<void> {
    if (!onboarding.isSubmitted) {
      throw new Error('Only submitted onboardings can be processed. Call submit() first.');
    }

    // --- Pass 1: Guard against duplicate opening balances ---
    for (const item of onboarding.items) {
      const hasEntries = await this.ledgerRepository.hasAnyEntries(item.variantId, onboarding.locationId);
      if (hasEntries) {
        throw new OpeningBalanceConflictError(item.variantId.value, onboarding.locationId.value);
      }
    }

    // --- Pass 2: Post ledger entries ---
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

      await this.ledgerRepository.append(entry);

      this.eventDispatcher(
        new OpeningBalancePosted(item.variantId.value, item.quantity, onboarding.id.value)
      );
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
