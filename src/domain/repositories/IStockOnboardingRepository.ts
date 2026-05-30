import { StockOnboarding } from '../entities/StockOnboarding';
import { StockOnboardingId } from '../valueObjects/StockOnboardingId';
import { TenantId } from '../valueObjects/TenantId';

export interface IStockOnboardingRepository {
  findById(id: StockOnboardingId): Promise<StockOnboarding | null>;
  findAllByTenant(tenantId: TenantId): Promise<StockOnboarding[]>;
  save(onboarding: StockOnboarding): Promise<void>;
}
