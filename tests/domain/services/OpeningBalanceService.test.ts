import { OpeningBalanceService } from '../../../src/domain/services/OpeningBalanceService';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { StockOnboarding } from '../../../src/domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../../src/domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import { OpeningBalanceConflictError } from '../../../src/domain/exceptions/DomainErrors';
import { OpeningBalancePosted } from '../../../src/domain/events/OnboardingEvents';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';

describe('OpeningBalanceService', () => {
  let mockLedgerRepository: jest.Mocked<ILedgerRepository>;
  let mockEventDispatcher: jest.Mock<void, [any]>;
  let service: OpeningBalanceService;

  beforeEach(() => {
    mockLedgerRepository = {
      append: jest.fn(),
      appendBatch: jest.fn(),
      currentQuantity: jest.fn(),
      currentQuantities: jest.fn(),
      entriesFor: jest.fn(),
      findRecallEntries: jest.fn(),
      currentQuantityAt: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasAnyEntriesBatch: jest.fn(),
    };
    mockEventDispatcher = jest.fn();
    service = new OpeningBalanceService(mockLedgerRepository, mockEventDispatcher);
  });

  const createOnboarding = (isSubmitted = false) => {
    const onboarding = new StockOnboarding(
      new StockOnboardingId('ob-123'),
      new TenantId('tenant-1'),
      new LocationId('loc-1'),
      new Date('2023-01-01T00:00:00Z')
    );
    onboarding.setItem(new ProductVariantId('var-1'), 10, 100);
    onboarding.setItem(new ProductVariantId('var-2'), 20, 200);

    if (isSubmitted) {
      onboarding.submit();
    }

    return onboarding;
  };

  const actor = new ActorId('user-1');

  it('should throw an error if onboarding is not submitted', async () => {
    const onboarding = createOnboarding(false);

    await expect(service.process(onboarding, actor)).rejects.toThrow('Only submitted onboardings can be processed. Call submit() first.');
  });

  it('should throw an OpeningBalanceConflictError if balance already exists for any item', async () => {
    const onboarding = createOnboarding(true);

    mockLedgerRepository.hasAnyEntriesBatch.mockResolvedValue(
      new Map([
        ['var-1', false],
        ['var-2', true],
      ])
    );

    await expect(service.process(onboarding, actor)).rejects.toThrow(OpeningBalanceConflictError);
    await expect(service.process(onboarding, actor)).rejects.toThrow('Opening balance already exists for SKU var-2 at location loc-1.');
  });

  it('should successfully post ledger entries and dispatch events if no conflict', async () => {
    const onboarding = createOnboarding(true);

    mockLedgerRepository.hasAnyEntriesBatch.mockResolvedValue(
      new Map([
        ['var-1', false],
        ['var-2', false],
      ])
    );

    await service.process(onboarding, actor);

    expect(mockLedgerRepository.appendBatch).toHaveBeenCalledTimes(1);

    const entries = mockLedgerRepository.appendBatch.mock.calls[0][0];
    expect(entries.length).toBe(2);

    // Check entry 1
    expect(entries[0].tenantId.value).toBe('tenant-1');
    expect(entries[0].locationId.value).toBe('loc-1');
    expect(entries[0].variantId.value).toBe('var-1');
    expect(entries[0].quantity).toBe(10);
    expect(entries[0].reason).toBe(ReasonCode.OpeningBalance);
    expect(entries[0].actor.value).toBe('user-1');
    expect(entries[0].referenceId).toBe('ob-123');
    expect(entries[0].metadata).toEqual({ unitCostCents: 100 });

    // Check entry 2
    expect(entries[1].variantId.value).toBe('var-2');
    expect(entries[1].quantity).toBe(20);

    expect(mockEventDispatcher).toHaveBeenCalledTimes(2);
    expect(mockEventDispatcher).toHaveBeenNthCalledWith(1, expect.any(OpeningBalancePosted));

    const event1 = mockEventDispatcher.mock.calls[0][0] as OpeningBalancePosted;
    expect(event1.sku).toBe('var-1');
    expect(event1.quantity).toBe(10);
    expect(event1.onboardingId).toBe('ob-123');

    const event2 = mockEventDispatcher.mock.calls[1][0] as OpeningBalancePosted;
    expect(event2.sku).toBe('var-2');
    expect(event2.quantity).toBe(20);
    expect(event2.onboardingId).toBe('ob-123');
  });
});
