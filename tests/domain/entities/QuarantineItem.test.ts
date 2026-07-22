import { QuarantineItem } from '../../../src/domain/entities/QuarantineItem';
import { QuarantineStatus } from '../../../src/domain/enums/ReturnEnums';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';

describe('QuarantineItem', () => {
  const createValidItem = (status = QuarantineStatus.Quarantined) => {
    return new QuarantineItem(
      'q-1',
      new ProductVariantId('v-1'),
      10,
      'Damaged box',
      new LocationId('loc-1'),
      new TenantId('t-1'),
      status
    );
  };

  describe('resolveScrap', () => {
    it('should set status to Scrapped and resolvedAt to a date', () => {
        const item = createValidItem();
        item.resolveScrap();
        expect(item.status).toBe(QuarantineStatus.Scrapped);
        expect(item.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if already resolved (called twice)', () => {
      const item = createValidItem();
      item.resolveScrap();
      expect(() => item.resolveScrap()).toThrow('Quarantine item is already resolved.');
  let variantId: ProductVariantId;
  let locationId: LocationId;
  let tenantId: TenantId;

  beforeEach(() => {
    variantId = new ProductVariantId('var-123');
    locationId = new LocationId('loc-123');
    tenantId = new TenantId('tenant-123');
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
      expect(() => {
        new QuarantineItem(
          'quarantine-1',
          variantId,
          0,
          'Damaged packaging',
          locationId,
          tenantId
        );
      }).toThrow('Quantity must be greater than zero.');

    it('should throw an error if quantity is negative', () => {
          -5,

  describe('resolution methods', () => {
    let item: QuarantineItem;

    beforeEach(() => {
      item = new QuarantineItem(

    describe('resolveRestock', () => {
      it('should change status to Restocked and set resolvedAt', () => {
        item.resolveRestock();

        expect(item.status).toBe(QuarantineStatus.Restocked);
      });

      it('should throw an error if already resolved', () => {

        expect(() => {
          item.resolveRestock();
        }).toThrow('Quarantine item is already resolved.');

    describe('resolveScrap', () => {
      it('should change status to Scrapped and set resolvedAt', () => {



          item.resolveScrap();

    describe('resolveRtv', () => {
      it('should change status to Rtv and set resolvedAt', () => {
        item.resolveRtv();

        expect(item.status).toBe(QuarantineStatus.Rtv);


          item.resolveRtv();
    });
  });
});
