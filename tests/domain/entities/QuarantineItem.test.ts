import { QuarantineItem } from '../../../src/domain/entities/QuarantineItem';
import { QuarantineStatus } from '../../../src/domain/enums/ReturnEnums';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';

describe('QuarantineItem', () => {
  let quarantineItem: QuarantineItem;

  beforeEach(() => {
    quarantineItem = new QuarantineItem(
      'q-123',
      new ProductVariantId('var-1'),
      10,
      'Damaged packaging',
      new LocationId('loc-1'),
      new TenantId('tenant-1')
    );
  });

  it('should initialize with default values correctly', () => {
    expect(quarantineItem.id).toBe('q-123');
    expect(quarantineItem.status).toBe(QuarantineStatus.Quarantined);
    expect(quarantineItem.resolvedAt).toBeNull();
  });

  describe('resolveRestock', () => {
    it('should successfully update status to Restocked and set resolvedAt', () => {
      quarantineItem.resolveRestock();

      expect(quarantineItem.status).toBe(QuarantineStatus.Restocked);
      expect(quarantineItem.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if already resolved', () => {
      quarantineItem.resolveRestock();

      expect(() => {
        quarantineItem.resolveRestock();
      }).toThrow('Quarantine item is already resolved.');
    });
  });

  describe('resolveScrap', () => {
    it('should successfully update status to Scrapped and set resolvedAt', () => {
      quarantineItem.resolveScrap();

      expect(quarantineItem.status).toBe(QuarantineStatus.Scrapped);
      expect(quarantineItem.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if already resolved', () => {
      quarantineItem.resolveScrap();

      expect(() => {
        quarantineItem.resolveScrap();
      }).toThrow('Quarantine item is already resolved.');
    });
  });

  describe('resolveRtv', () => {
    it('should successfully update status to Rtv and set resolvedAt', () => {
      quarantineItem.resolveRtv();

      expect(quarantineItem.status).toBe(QuarantineStatus.Rtv);
      expect(quarantineItem.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if already resolved', () => {
      quarantineItem.resolveRtv();

      expect(() => {
        quarantineItem.resolveRtv();
      }).toThrow('Quarantine item is already resolved.');
    });
  });

  describe('constructor validation', () => {
    it('should throw an error if quantity is less than or equal to zero', () => {
      expect(() => {
        new QuarantineItem(
          'q-124',
          new ProductVariantId('var-1'),
          0,
          'Damaged packaging',
          new LocationId('loc-1'),
          new TenantId('tenant-1')
        );
      }).toThrow('Quantity must be greater than zero.');
    });
  });
});
