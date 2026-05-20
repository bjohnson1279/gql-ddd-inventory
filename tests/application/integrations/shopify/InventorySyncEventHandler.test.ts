import { InventorySyncEventHandler } from '../../../../src/application/integrations/shopify/InventorySyncEventHandler';
import { SyncInventoryToShopify } from '../../../../src/application/integrations/shopify/SyncInventoryToShopify';
import { InventoryDecremented } from '../../../../src/domain/events/InventoryEvents';
import { ProductVariantId } from '../../../../src/domain/valueObjects/ProductVariantId';

describe('InventorySyncEventHandler', () => {
  it('should call the sync use case when handling InventoryDecremented', async () => {
    const mockSyncUseCase = {
      execute: jest.fn(),
    } as any;

    const handler = new InventorySyncEventHandler(mockSyncUseCase);
    const event = new InventoryDecremented('T1', 'L1', new ProductVariantId('V1'), 5, 'S1');

    await handler.handleInventoryDecremented(event);

    expect(mockSyncUseCase.execute).toHaveBeenCalledWith('T1', 'L1', 'V1');
  });
});
