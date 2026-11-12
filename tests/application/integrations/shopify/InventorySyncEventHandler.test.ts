import { InventorySyncEventHandler } from '../../../../src/application/integrations/shopify/InventorySyncEventHandler';
import { SyncInventoryToShopify } from '../../../../src/application/integrations/shopify/SyncInventoryToShopify';
import { InventoryDecremented } from '../../../../src/domain/events/InventoryEvents';
import { ProductVariantId } from '../../../../src/domain/valueObjects/ProductVariantId';

describe('InventorySyncEventHandler', () => {
  let syncUseCase: jest.Mocked<Partial<SyncInventoryToShopify>>;
  let handler: InventorySyncEventHandler;

  beforeEach(() => {
    syncUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    handler = new InventorySyncEventHandler(syncUseCase as SyncInventoryToShopify);
  });

  it('should call execute on SyncInventoryToShopify with event tenantId, locationId, and variantId string value', async () => {
    const tenantId = 'tenant-42';
    const locationId = 'loc-99';
    const variantIdValue = 'variant-uuid-123';
    const variantId = new ProductVariantId(variantIdValue);
    const quantity = 5;
    const referenceId = 'order-ref-1';

    const event = new InventoryDecremented(
      tenantId,
      locationId,
      variantId,
      quantity,
      referenceId
    );

    await handler.handleInventoryDecremented(event);

    expect(syncUseCase.execute).toHaveBeenCalledTimes(1);
    expect(syncUseCase.execute).toHaveBeenCalledWith(tenantId, locationId, variantIdValue);
  });

  it('should propagate errors if SyncInventoryToShopify.execute throws', async () => {
    const error = new Error('Shopify sync failure');
    (syncUseCase.execute as jest.Mock).mockRejectedValueOnce(error);

    const event = new InventoryDecremented(
      'tenant-1',
      'loc-1',
      new ProductVariantId('var-1'),
      2,
      'ref-1'
    );

    await expect(handler.handleInventoryDecremented(event)).rejects.toThrow('Shopify sync failure');
    expect(syncUseCase.execute).toHaveBeenCalledWith('tenant-1', 'loc-1', 'var-1');
  });
});
