import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { OpeningBalanceService } from '../../domain/services/OpeningBalanceService';
import { StockOnboarding } from '../../domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { Sku } from '../../domain/valueObjects/Sku';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';

export interface OpeningBalanceItemInput {
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

export interface SubmitOpeningBalanceInput {
  tenantId: string;
  locationId: string;
  items: OpeningBalanceItemInput[];
  asOfDate: string;
  actorId: string;
}

export class SubmitOpeningBalanceUseCase {
  constructor(
    private readonly openingBalanceService: OpeningBalanceService
  ) {}

  async execute(input: SubmitOpeningBalanceInput): Promise<boolean> {
    const onboarding = new StockOnboarding(
      new StockOnboardingId(Math.random().toString(36).substring(2, 15)),
      new TenantId(input.tenantId),
      new LocationId(input.locationId),
      new Date(input.asOfDate)
    );

    for (const item of input.items) {
      onboarding.setItem(
        new ProductVariantId(item.variantId),
        item.quantity,
        item.unitCostCents
      );
    }

    onboarding.submit();

    await this.openingBalanceService.process(
      onboarding,
      new ActorId(input.actorId)
    );

    return true;
  }
}
