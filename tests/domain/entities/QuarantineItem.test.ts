import { QuarantineItem } from '../../../src/domain/entities/QuarantineItem';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { QuarantineStatus } from '../../../src/domain/enums/ReturnEnums';

describe('QuarantineItem', () => {
  const validId = 'quarantine-1';
  const variantId = new ProductVariantId('variant-1');
  const locationId = new LocationId('loc-1');
  const tenantId = new TenantId('tenant-1');
  const reason = 'Damaged packaging';

  describe('constructor', () => {
    it('should create a QuarantineItem with valid properties', () => {
      const quantity = 10;
      const item = new QuarantineItem(
        validId,
        variantId,
        quantity,
        reason,
        locationId,
        tenantId
      );

      expect(item.id).toBe(validId);
      expect(item.variantId).toBe(variantId);
      expect(item.quantity).toBe(quantity);
      expect(item.reason).toBe(reason);
      expect(item.locationId).toBe(locationId);
      expect(item.tenantId).toBe(tenantId);
      expect(item.status).toBe(QuarantineStatus.Quarantined);
      expect(item.resolvedAt).toBeNull();
      expect(item.createdAt).toBeInstanceOf(Date);
    });

    it('should throw an error if quantity is zero', () => {
      const quantity = 0;
      expect(() => {
        new QuarantineItem(
          validId,
          variantId,
          quantity,
          reason,
          locationId,
          tenantId
        );
      }).toThrow('Quantity must be greater than zero.');
    });

    it('should throw an error if quantity is negative', () => {
      const quantity = -5;
      expect(() => {
        new QuarantineItem(
          validId,
          variantId,
          quantity,
          reason,
          locationId,
          tenantId
        );
      }).toThrow('Quantity must be greater than zero.');
    });
  });

  describe('state resolution', () => {
    it('should resolve to Restocked', () => {
      const item = new QuarantineItem(validId, variantId, 10, reason, locationId, tenantId);
      item.resolveRestock();

      expect(item.status).toBe(QuarantineStatus.Restocked);
      expect(item.resolvedAt).toBeInstanceOf(Date);
    });

    it('should resolve to Scrapped', () => {
      const item = new QuarantineItem(validId, variantId, 10, reason, locationId, tenantId);
      item.resolveScrap();

      expect(item.status).toBe(QuarantineStatus.Scrapped);
      expect(item.resolvedAt).toBeInstanceOf(Date);
    });

    it('should resolve to Rtv', () => {
      const item = new QuarantineItem(validId, variantId, 10, reason, locationId, tenantId);
      item.resolveRtv();

      expect(item.status).toBe(QuarantineStatus.Rtv);
      expect(item.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw if resolving an already resolved item (Restock)', () => {
      const item = new QuarantineItem(validId, variantId, 10, reason, locationId, tenantId);
      item.resolveRestock();

      expect(() => item.resolveRestock()).toThrow('Quarantine item is already resolved.');
    });

    it('should throw if resolving an already resolved item (Scrap)', () => {
      const item = new QuarantineItem(validId, variantId, 10, reason, locationId, tenantId);
      item.resolveScrap();

      expect(() => item.resolveScrap()).toThrow('Quarantine item is already resolved.');
    });

    it('should throw if resolving an already resolved item (Rtv)', () => {
      const item = new QuarantineItem(validId, variantId, 10, reason, locationId, tenantId);
      item.resolveRtv();

      expect(() => item.resolveRtv()).toThrow('Quarantine item is already resolved.');
    });
  });
});
