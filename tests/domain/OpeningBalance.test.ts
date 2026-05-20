import { StockOnboarding } from '../../src/domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../src/domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { OpeningBalanceService } from '../../src/domain/services/OpeningBalanceService';
import { InMemoryLedgerRepository } from '../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { OpeningBalanceConflictError, OnboardingAlreadySubmittedError } from '../../src/domain/exceptions/DomainErrors';
import { StockOnboardingStatus } from '../../src/domain/enums/StockOnboardingStatus';

describe('Opening Balance', () => {
  let ledgerRepository: InMemoryLedgerRepository;
  let openingBalanceService: OpeningBalanceService;
  const tenantId = new TenantId('tenant-1');
  const locationId = new LocationId('loc-1');
  const actorId = new ActorId('user-1');
  const asOfDate = new Date('2024-01-01');

  beforeEach(() => {
    ledgerRepository = new InMemoryLedgerRepository();
    openingBalanceService = new OpeningBalanceService(ledgerRepository);
  });

  it('should successfully post opening balance', async () => {
    // Arrange
    const onboarding = new StockOnboarding(
      new StockOnboardingId('ob-1'),
      tenantId,
      locationId,
      asOfDate
    );
    const vId1 = new ProductVariantId('V-1');
    const vId2 = new ProductVariantId('V-2');
    onboarding.setItem(vId1, 10, 1000);
    onboarding.setItem(vId2, 5, 2000);
    onboarding.submit();

    // Act
    await openingBalanceService.process(onboarding, actorId);

    // Assert
    expect(await ledgerRepository.currentQuantity(vId1, locationId)).toBe(10);
    expect(await ledgerRepository.currentQuantity(vId2, locationId)).toBe(5);
    
    const entries1 = await ledgerRepository.entriesFor(vId1, locationId);
    expect(entries1[0].metadata?.unitCostCents).toBe(1000);
    expect(entries1[0].occurredAt).toEqual(asOfDate);
    expect(entries1[0].referenceId).toBe('ob-1');
  });

  it('should throw error when submitting with no items', () => {
    const onboarding = new StockOnboarding(
      new StockOnboardingId('ob-1'),
      tenantId,
      locationId,
      asOfDate
    );

    expect(() => onboarding.submit()).toThrow('Cannot submit a stock onboarding with no items.');
  });

  it('should throw error when modifying after submission', () => {
    const onboarding = new StockOnboarding(
      new StockOnboardingId('ob-1'),
      tenantId,
      locationId,
      asOfDate
    );
    onboarding.setItem(new ProductVariantId('V-1'), 10, 1000);
    onboarding.submit();

    expect(() => onboarding.setItem(new ProductVariantId('V-2'), 5, 2000)).toThrow(OnboardingAlreadySubmittedError);
    expect(() => onboarding.removeItem(new ProductVariantId('V-1'))).toThrow(OnboardingAlreadySubmittedError);
  });

  it('should throw error if opening balance already exists for a SKU', async () => {
    // Arrange
    const vId1 = new ProductVariantId('V-1');
    // Pre-populate ledger
    await ledgerRepository.append(
      anyLedgerEntry(vId1, 1)
    );

    const onboarding = new StockOnboarding(
      new StockOnboardingId('ob-1'),
      tenantId,
      locationId,
      asOfDate
    );
    onboarding.setItem(vId1, 10, 1000);
    onboarding.submit();

    // Act & Assert
    await expect(openingBalanceService.process(onboarding, actorId)).rejects.toThrow(OpeningBalanceConflictError);
  });

  function anyLedgerEntry(variantId: ProductVariantId, quantity: number) {
    const { LedgerEntry } = require('../../src/domain/entities/LedgerEntry');
    const { LedgerEntryId } = require('../../src/domain/valueObjects/LedgerEntryId');
    const { ReasonCode } = require('../../src/domain/enums/ReasonCode');
    return new LedgerEntry(
      new LedgerEntryId('e-1'),
      tenantId,
      locationId,
      variantId,
      quantity,
      ReasonCode.CountAdjustment,
      actorId,
      new Date()
    );
  }
});
