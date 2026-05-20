import { StockOnboardingId } from '../valueObjects/StockOnboardingId';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';
import { StockOnboardingStatus } from '../enums/StockOnboardingStatus';
import { StockOnboardingItem } from '../valueObjects/StockOnboardingItem';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { OnboardingAlreadySubmittedError } from '../exceptions/DomainErrors';
import { DomainEvent, StockOnboardingSubmitted } from '../events/OnboardingEvents';

export class StockOnboarding {
  private _status: StockOnboardingStatus;
  private _items: Map<string, StockOnboardingItem> = new Map();
  private _domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: StockOnboardingId,
    public readonly tenantId: TenantId,
    public readonly locationId: LocationId,
    public readonly asOfDate: Date
  ) {
    this._status = StockOnboardingStatus.Draft;
  }

  get status(): StockOnboardingStatus {
    return this._status;
  }

  get isSubmitted(): boolean {
    return this._status === StockOnboardingStatus.Submitted;
  }

  get items(): StockOnboardingItem[] {
    return Array.from(this._items.values());
  }

  setItem(variantId: ProductVariantId, quantity: number, unitCostCents: number): void {
    this.assertDraft();

    this._items.set(variantId.value, new StockOnboardingItem(variantId, quantity, unitCostCents));
  }

  removeItem(variantId: ProductVariantId): void {
    this.assertDraft();
    this._items.delete(variantId.value);
  }

  submit(): void {
    this.assertDraft();

    if (this._items.size === 0) {
      throw new Error('Cannot submit a stock onboarding with no items.');
    }

    this._status = StockOnboardingStatus.Submitted;
    this._domainEvents.push(new StockOnboardingSubmitted(this.id.value, this.locationId.value));
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  private assertDraft(): void {
    if (this._status !== StockOnboardingStatus.Draft) {
      throw new OnboardingAlreadySubmittedError(this.id.value);
    }
  }
}
