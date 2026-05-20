import { SerializedItemReceived, SerializedItemSold, SerializedItemStatusChanged } from '../../src/domain/events/SerialEvents';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../src/domain/valueObjects/SerialNumber';
import { SerializedItemStatus } from '../../src/domain/enums/SerializedItemStatus';
import { BarcodeAssigned, BarcodeRevoked } from '../../src/domain/events/BarcodeEvents';
import { StockOnboardingSubmitted, OpeningBalancePosted } from '../../src/domain/events/OnboardingEvents';
import { InventoryDecremented } from '../../src/domain/events/InventoryEvents';

describe('Event Coverage Gaps', () => {
  const vId = new ProductVariantId('V1');
  const sn = new SerialNumber('SN1');

  it('should cover SerialEvents', () => {
    new SerializedItemReceived(vId, sn, 'L1', 'R1');
    new SerializedItemSold(vId, sn, 'S1');
    new SerializedItemStatusChanged(vId, sn, SerializedItemStatus.Pending, SerializedItemStatus.InStock);
  });

  it('should cover BarcodeEvents', () => {
    new BarcodeAssigned('SKU1', 'B1');
    new BarcodeRevoked('SKU1', 'B1');
  });

  it('should cover OnboardingEvents', () => {
    new StockOnboardingSubmitted('OB1', 'L1');
    new OpeningBalancePosted('SKU1', 10, 'OB1');
  });

  it('should cover InventoryEvents', () => {
    new InventoryDecremented('T1', 'L1', vId, 5, 'S1');
  });
});
