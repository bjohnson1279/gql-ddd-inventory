import { ProductRecallService } from '../../../src/domain/services/ProductRecallService';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { LedgerEntry } from '../../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../../src/domain/valueObjects/LedgerEntryId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';

describe('ProductRecallService', () => {
  let mockLedgerRepo: jest.Mocked<ILedgerRepository>;
  let service: ProductRecallService;

  beforeEach(() => {
    mockLedgerRepo = {
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
    service = new ProductRecallService(mockLedgerRepo);
  });

  describe('traceProductRecall', () => {
    it('should throw an error if the lot number is empty', async () => {
      await expect(service.traceProductRecall('')).rejects.toThrow("Lot number cannot be empty.");
      await expect(service.traceProductRecall('   ')).rejects.toThrow("Lot number cannot be empty.");
    });

    it('should return an empty array if no recall entries are found', async () => {
      mockLedgerRepo.findRecallEntries.mockResolvedValue([]);

      const dispatches = await service.traceProductRecall('LOT123');
      expect(dispatches).toEqual([]);
      expect(mockLedgerRepo.findRecallEntries).toHaveBeenCalledWith('LOT123');
    });

    it('should filter only deductions and map them to ContaminatedDispatch', async () => {
      const now = new Date();

      const additionEntry = new LedgerEntry(
        new LedgerEntryId('entry-1'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        new ProductVariantId('var-1'),
        100, // positive quantity
        ReasonCode.OpeningBalance,
        new ActorId('actor-1'),
        now,
        'ref-1'
      );

      const deductionEntry1 = new LedgerEntry(
        new LedgerEntryId('entry-2'),
        new TenantId('tenant-1'),
        new LocationId('loc-2'),
        new ProductVariantId('var-1'),
        -20, // deduction
        ReasonCode.Sale,
        new ActorId('actor-2'),
        now,
        'ref-2'
      );

      const deductionEntry2 = new LedgerEntry(
        new LedgerEntryId('entry-3'),
        new TenantId('tenant-1'),
        new LocationId('loc-3'),
        new ProductVariantId('var-1'),
        -5, // deduction
        ReasonCode.CountAdjustment,
        new ActorId('actor-3'),
        now,
        undefined
      );

      mockLedgerRepo.findRecallEntries.mockResolvedValue([additionEntry, deductionEntry1, deductionEntry2]);

      const dispatches = await service.traceProductRecall('LOT123');

      expect(dispatches).toHaveLength(2);

      expect(dispatches[0]).toEqual({
        ledgerEntryId: 'entry-2',
        locationId: 'loc-2',
        quantity: 20, // Math.abs(-20)
        referenceId: 'ref-2',
        occurredAt: now,
        actorId: 'actor-2'
      });

      expect(dispatches[1]).toEqual({
        ledgerEntryId: 'entry-3',
        locationId: 'loc-3',
        quantity: 5, // Math.abs(-5)
        referenceId: undefined,
        occurredAt: now,
        actorId: 'actor-3'
      });

      expect(mockLedgerRepo.findRecallEntries).toHaveBeenCalledWith('LOT123');
    });

    it('should bubble up errors thrown by the repository', async () => {
      mockLedgerRepo.findRecallEntries.mockRejectedValue(new Error('Database connection failed'));
      await expect(service.traceProductRecall('LOT123')).rejects.toThrow('Database connection failed');
    });

    it('should handle undefined lotNumber properly without crashing if ignored by TS', async () => {
      await expect(service.traceProductRecall(undefined as unknown as string)).rejects.toThrow("Lot number cannot be empty.");
      await expect(service.traceProductRecall(null as unknown as string)).rejects.toThrow("Lot number cannot be empty.");
    });
  });
});
