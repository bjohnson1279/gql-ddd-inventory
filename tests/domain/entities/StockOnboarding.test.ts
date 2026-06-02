import { StockOnboarding } from '../../../src/domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../../src/domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { StockOnboardingStatus } from '../../../src/domain/enums/StockOnboardingStatus';
import { OnboardingAlreadySubmittedError } from '../../../src/domain/exceptions/DomainErrors';
import { StockOnboardingSubmitted } from '../../../src/domain/events/OnboardingEvents';

describe('StockOnboarding', () => {
  let onboarding: StockOnboarding;

  beforeEach(() => {
    onboarding = new StockOnboarding(
      new StockOnboardingId('ob-123'),
      new TenantId('tenant-1'),
      new LocationId('loc-1'),
      new Date()
    );
  });

  describe('status', () => {
    it('should be initialized as Draft', () => {
      expect(onboarding.status).toBe(StockOnboardingStatus.Draft);
    });

    it('should return Submitted when isSubmitted is true', () => {
      const variantId = new ProductVariantId('var-1');
      onboarding.setItem(variantId, 10, 100);
      onboarding.submit();

      expect(onboarding.status).toBe(StockOnboardingStatus.Submitted);
      expect(onboarding.isSubmitted).toBe(true);
    });
  });

  describe('removeItem', () => {
    it('should successfully remove an item', () => {
      const variantId = new ProductVariantId('var-1');
      onboarding.setItem(variantId, 10, 100);
      expect(onboarding.items).toHaveLength(1);

      onboarding.removeItem(variantId);
      expect(onboarding.items).toHaveLength(0);
    });

    it('should throw an error if trying to remove an item after submission', () => {
      const variantId = new ProductVariantId('var-1');
      onboarding.setItem(variantId, 10, 100);
      onboarding.submit();

      expect(() => {
        onboarding.removeItem(variantId);
      }).toThrow(OnboardingAlreadySubmittedError);
    });
  });

  describe('pullDomainEvents', () => {
    it('should return an empty array if no events have been pushed', () => {
      const events = onboarding.pullDomainEvents();
      expect(events).toEqual([]);
    });

    it('should retrieve and clear events after submission', () => {
      const variantId = new ProductVariantId('var-1');
      onboarding.setItem(variantId, 10, 100);
      onboarding.submit();

      const events = onboarding.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(StockOnboardingSubmitted);
      expect((events[0] as StockOnboardingSubmitted).onboardingId).toBe('ob-123');
      expect((events[0] as StockOnboardingSubmitted).locationId).toBe('loc-1');

      // Subsequent pull should be empty
      const subsequentEvents = onboarding.pullDomainEvents();
      expect(subsequentEvents).toHaveLength(0);
    });
  });
});
