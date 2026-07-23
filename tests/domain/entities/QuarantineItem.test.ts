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

  describe('resolveRestock', () => {
    it('should successfully update status to Restocked and set resolvedAt', () => {
      quarantineItem.resolveRestock();

      expect(quarantineItem.status).toBe(QuarantineStatus.Restocked);
      expect(quarantineItem.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if already resolved', () => {

      expect(() => {
        quarantineItem.resolveRestock();
      }).toThrow('Quarantine item is already resolved.');

  describe('resolveScrap', () => {
    it('should successfully update status to Scrapped and set resolvedAt', () => {
      quarantineItem.resolveScrap();

      expect(quarantineItem.status).toBe(QuarantineStatus.Scrapped);


        quarantineItem.resolveScrap();

  describe('resolveRtv', () => {
    it('should successfully update status to Rtv and set resolvedAt', () => {
      quarantineItem.resolveRtv();

      expect(quarantineItem.status).toBe(QuarantineStatus.Rtv);


        quarantineItem.resolveRtv();

  describe('constructor validation', () => {
    it('should throw an error if quantity is less than or equal to zero', () => {
        new QuarantineItem(
          'q-124',
          new ProductVariantId('var-1'),
          0,
          'Damaged packaging',
          new LocationId('loc-1'),
          new TenantId('tenant-1')
  let variantId: ProductVariantId;
  let locationId: LocationId;
  let tenantId: TenantId;

    variantId = new ProductVariantId('var-123');
    locationId = new LocationId('loc-123');
    tenantId = new TenantId('tenant-123');
  beforeEach(() => {
  });

  describe('constructor', () => {
    it('should successfully initialize a valid QuarantineItem', () => {
      const item = new QuarantineItem(
        'quarantine-1',
        variantId,
        10,
        'Damaged packaging',
        locationId,
        tenantId
      );

      expect(item.id).toBe('quarantine-1');
      expect(item.variantId).toBe(variantId);
      expect(item.quantity).toBe(10);
      expect(item.reason).toBe('Damaged packaging');
      expect(item.locationId).toBe(locationId);
      expect(item.tenantId).toBe(tenantId);
      expect(item.status).toBe(QuarantineStatus.Quarantined);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.resolvedAt).toBeNull();

    it('should throw an error if quantity is zero', () => {
          'quarantine-1',
          variantId,
    });

      expect(() => {
        new QuarantineItem(
          0,
          'Damaged packaging',
          locationId,
          tenantId
        );
      }).toThrow('Quantity must be greater than zero.');

    it('should throw an error if quantity is negative', () => {
          -5,
    });

      expect(() => {
        new QuarantineItem(
          'quarantine-1',
          variantId,
          'Damaged packaging',
          locationId,
          tenantId
        );
      }).toThrow('Quantity must be greater than zero.');
    });
  });

  describe('resolution methods', () => {
    let item: QuarantineItem;

    beforeEach(() => {
      item = new QuarantineItem(
        'quarantine-1',
        variantId,
        10,
        'Damaged packaging',
        locationId,
        tenantId
      );
    });

    describe('resolveRestock', () => {
      it('should change status to Restocked and set resolvedAt', () => {
        item.resolveRestock();

        expect(item.status).toBe(QuarantineStatus.Restocked);
        expect(item.resolvedAt).toBeInstanceOf(Date);
      });

      it('should throw an error if already resolved', () => {
        item.resolveRestock();

        expect(() => {
          item.resolveRestock();
        }).toThrow('Quarantine item is already resolved.');
      });
    });

    describe('resolveScrap', () => {
      it('should change status to Scrapped and set resolvedAt', () => {
        item.resolveScrap();

        expect(item.status).toBe(QuarantineStatus.Scrapped);


          item.resolveScrap();
        expect(item.resolvedAt).toBeInstanceOf(Date);
      });

      it('should throw an error if already resolved', () => {
        item.resolveScrap();

        expect(() => {
        }).toThrow('Quarantine item is already resolved.');
    });

    describe('resolveRtv', () => {
      it('should change status to Rtv and set resolvedAt', () => {
        item.resolveRtv();

        expect(item.status).toBe(QuarantineStatus.Rtv);


          item.resolveRtv();
        expect(item.resolvedAt).toBeInstanceOf(Date);
      });

      it('should throw an error if already resolved', () => {
        item.resolveRtv();

        expect(() => {
        }).toThrow('Quarantine item is already resolved.');
    });
  });
});
