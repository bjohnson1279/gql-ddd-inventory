import { SubmitOpeningBalanceUseCase, SubmitOpeningBalanceInput } from '../../../src/application/useCases/SubmitOpeningBalance';
import { OpeningBalanceService } from '../../../src/domain/services/OpeningBalanceService';
import { StockOnboarding } from '../../../src/domain/entities/StockOnboarding';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

describe('SubmitOpeningBalanceUseCase', () => {
  let mockOpeningBalanceService: jest.Mocked<OpeningBalanceService>;

  beforeEach(() => {
    // Mock the dependencies
    mockOpeningBalanceService = {
      process: jest.fn(),
      ledgerRepository: {} as any, // Not used directly in use case
      eventDispatcher: jest.fn() as any, // Not used directly in use case
      generateId: jest.fn() as any // Private method, don't strictly need to mock but good for complete mock shape
    } as unknown as jest.Mocked<OpeningBalanceService>;
  });

  it('should create onboarding, set items, submit, and process successfully', async () => {
    const useCase = new SubmitOpeningBalanceUseCase(mockOpeningBalanceService);

    const input: SubmitOpeningBalanceInput = {
      tenantId: 'tenant-123',
      locationId: 'loc-456',
      asOfDate: '2023-10-27T10:00:00Z',
      actorId: 'user-789',
      items: [
        {
          variantId: 'var-1',
          quantity: 10,
          unitCostCents: 500
        },
        {
          variantId: 'var-2',
          quantity: 20,
          unitCostCents: 1000
        }
      ]
    };

    mockOpeningBalanceService.process.mockResolvedValue();

    const result = await useCase.execute(input);

    expect(result).toBe(true);
    expect(mockOpeningBalanceService.process).toHaveBeenCalledTimes(1);

    const [onboardingArg, actorIdArg] = mockOpeningBalanceService.process.mock.calls[0];

    // Assert Onboarding entity properties
    expect(onboardingArg).toBeInstanceOf(StockOnboarding);
    expect(onboardingArg.tenantId.value).toBe(input.tenantId);
    expect(onboardingArg.locationId.value).toBe(input.locationId);
    expect(onboardingArg.asOfDate.toISOString()).toBe(new Date(input.asOfDate).toISOString());
    expect(onboardingArg.isSubmitted).toBe(true);

    // Assert Onboarding items
    expect(onboardingArg.items.length).toBe(2);
    expect(onboardingArg.items[0].variantId.value).toBe(input.items[0].variantId);
    expect(onboardingArg.items[0].quantity).toBe(input.items[0].quantity);
    expect(onboardingArg.items[0].unitCostCents).toBe(input.items[0].unitCostCents);
    expect(onboardingArg.items[1].variantId.value).toBe(input.items[1].variantId);
    expect(onboardingArg.items[1].quantity).toBe(input.items[1].quantity);
    expect(onboardingArg.items[1].unitCostCents).toBe(input.items[1].unitCostCents);

    // Assert Actor ID
    expect(actorIdArg).toBeInstanceOf(ActorId);
    expect(actorIdArg.value).toBe(input.actorId);
  });

  it('should propagate errors from the OpeningBalanceService', async () => {
    const useCase = new SubmitOpeningBalanceUseCase(mockOpeningBalanceService);

    const input: SubmitOpeningBalanceInput = {
      tenantId: 'tenant-123',
      locationId: 'loc-456',
      asOfDate: '2023-10-27T10:00:00Z',
      actorId: 'user-789',
      items: [
        {
          variantId: 'var-1',
          quantity: 10,
          unitCostCents: 500
        }
      ]
    };

    const expectedError = new Error('Processing failed');
    mockOpeningBalanceService.process.mockRejectedValue(expectedError);

    await expect(useCase.execute(input)).rejects.toThrow(expectedError);
    expect(mockOpeningBalanceService.process).toHaveBeenCalledTimes(1);
  });
});
