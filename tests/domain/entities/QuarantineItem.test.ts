import { QuarantineItem } from '../../../src/domain/entities/QuarantineItem';
import { QuarantineStatus } from '../../../src/domain/enums/ReturnEnums';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';

describe('QuarantineItem', () => {
  let item: QuarantineItem;

  beforeEach(() => {
    item = new QuarantineItem(
      'q-123',
      new ProductVariantId('v-123'),
      5,
      'Damaged packaging',
      new LocationId('loc-1'),
      new TenantId('t-1')
    );
  });

  describe('constructor', () => {
    it('should create a QuarantineItem with correct initial values', () => {
      expect(item.id).toBe('q-123');
      expect(item.variantId.value).toBe('v-123');
      expect(item.quantity).toBe(5);
      expect(item.reason).toBe('Damaged packaging');
      expect(item.locationId.value).toBe('loc-1');
      expect(item.tenantId.value).toBe('t-1');
      expect(item.status).toBe(QuarantineStatus.Quarantined);
      expect(item.resolvedAt).toBeNull();
      expect(item.createdAt).toBeInstanceOf(Date);
    });

    it('should throw an error if quantity is zero or less', () => {
      expect(() => {
        new QuarantineItem(
          'q-124',
          new ProductVariantId('v-124'),
          0,
          'Test',
          new LocationId('loc-1'),
          new TenantId('t-1')
  let variantId: ProductVariantId;
  let locationId: LocationId;
  let tenantId: TenantId;

    variantId = new ProductVariantId('var-123');
    locationId = new LocationId('loc-123');
    tenantId = new TenantId('tenant-123');

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
      expect(item.locationId).toBe(locationId);
      expect(item.tenantId).toBe(tenantId);

    it('should throw an error if quantity is zero', () => {
          'quarantine-1',
          variantId,
          'Damaged packaging',
          locationId,
          tenantId
        );
      }).toThrow('Quantity must be greater than zero.');

    it('should throw an error if quantity is negative', () => {
          -5,
        );
      }).toThrow('Quantity must be greater than zero.');
    });
  });

  describe('resolveRestock', () => {
    it('should correctly set status to Restocked and update resolvedAt', () => {
      item.resolveRestock();
      expect(item.status).toBe(QuarantineStatus.Restocked);
      expect(item.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw an error when trying to resolve an already resolved item as Restock', () => {
      expect(() => {
        item.resolveRestock();
      }).toThrow('Quarantine item is already resolved.');
  });

  describe('resolveScrap', () => {
    it('should correctly set status to Scrapped and update resolvedAt', () => {
      item.resolveScrap();
      expect(item.status).toBe(QuarantineStatus.Scrapped);

    it('should throw an error when trying to resolve an already resolved item as Scrap', () => {
        item.resolveScrap();

  describe('resolveRtv', () => {
    it('should correctly set status to Rtv and update resolvedAt', () => {
      item.resolveRtv();
      expect(item.status).toBe(QuarantineStatus.Rtv);

    it('should throw an error when trying to resolve an already resolved item as RTV', () => {
        item.resolveRtv();
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

    describe('resolveRestock', () => {
      it('should change status to Restocked and set resolvedAt', () => {

        expect(item.status).toBe(QuarantineStatus.Restocked);
        expect(item.resolvedAt).toBeInstanceOf(Date);
      });

      it('should throw an error if already resolved', () => {

        expect(() => {
          item.resolveRestock();
        }).toThrow('Quarantine item is already resolved.');

    describe('resolveScrap', () => {
      it('should change status to Scrapped and set resolvedAt', () => {

        expect(item.status).toBe(QuarantineStatus.Scrapped);


          item.resolveScrap();

    describe('resolveRtv', () => {
      it('should change status to Rtv and set resolvedAt', () => {

        expect(item.status).toBe(QuarantineStatus.Rtv);


          item.resolveRtv();
    });
  });
});
