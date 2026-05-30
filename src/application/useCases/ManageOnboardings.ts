import { IStockOnboardingRepository } from '../../domain/repositories/IStockOnboardingRepository';
import { OpeningBalanceService } from '../../domain/services/OpeningBalanceService';
import { StockOnboarding } from '../../domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { ActorId } from '../../domain/valueObjects/ActorId';

export interface CreateStockOnboardingInput {
  id: string;
  tenantId: string;
  locationId: string;
  asOfDate: string;
}

export class CreateStockOnboardingUseCase {
  constructor(private readonly onboardingRepo: IStockOnboardingRepository) {}

  async execute(input: CreateStockOnboardingInput): Promise<boolean> {
    const onboarding = new StockOnboarding(
      new StockOnboardingId(input.id),
      new TenantId(input.tenantId),
      new LocationId(input.locationId),
      new Date(input.asOfDate)
    );

    await this.onboardingRepo.save(onboarding);
    return true;
  }
}

export interface OnboardingItemInput {
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

export interface SaveOnboardingItemsInput {
  id: string;
  items: OnboardingItemInput[];
}

export class SaveStockOnboardingItemsUseCase {
  constructor(private readonly onboardingRepo: IStockOnboardingRepository) {}

  async execute(input: SaveOnboardingItemsInput): Promise<boolean> {
    const onboarding = await this.onboardingRepo.findById(new StockOnboardingId(input.id));
    if (!onboarding) {
      throw new Error(`Stock onboarding ${input.id} not found.`);
    }

    for (const item of input.items) {
      onboarding.setItem(
        new ProductVariantId(item.variantId),
        item.quantity,
        item.unitCostCents
      );
    }

    await this.onboardingRepo.save(onboarding);
    return true;
  }
}

export class SubmitStockOnboardingUseCase {
  constructor(
    private readonly onboardingRepo: IStockOnboardingRepository,
    private readonly openingBalanceService: OpeningBalanceService
  ) {}

  async execute(onboardingId: string, actorId: string): Promise<boolean> {
    const onboarding = await this.onboardingRepo.findById(new StockOnboardingId(onboardingId));
    if (!onboarding) {
      throw new Error(`Stock onboarding ${onboardingId} not found.`);
    }

    onboarding.submit();
    await this.onboardingRepo.save(onboarding);

    await this.openingBalanceService.process(onboarding, new ActorId(actorId));
    return true;
  }
}

export class GetStockOnboardingUseCase {
  constructor(private readonly onboardingRepo: IStockOnboardingRepository) {}

  async execute(id: string): Promise<StockOnboarding | null> {
    return await this.onboardingRepo.findById(new StockOnboardingId(id));
  }
}

export class GetStockOnboardingsUseCase {
  constructor(private readonly onboardingRepo: IStockOnboardingRepository) {}

  async execute(tenantId: string): Promise<StockOnboarding[]> {
    return await this.onboardingRepo.findAllByTenant(new TenantId(tenantId));
  }
}
