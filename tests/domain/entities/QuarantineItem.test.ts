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
    });
  });
});
