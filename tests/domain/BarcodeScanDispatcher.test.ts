import { BarcodeScanDispatcher, ScanContext, IScanHandler } from '../../src/domain/services/BarcodeScanDispatcher';
import { BarcodeRegistry } from '../../src/domain/services/BarcodeRegistry';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { IBarcodeRepository } from '../../src/domain/repositories/IBarcodeRepository';

describe('BarcodeScanDispatcher', () => {
  let dispatcher: BarcodeScanDispatcher;
  let registry: BarcodeRegistry;
  let mockRepo: jest.Mocked<IBarcodeRepository>;

  beforeEach(() => {
    mockRepo = {
      findSkuByBarcodeValue: jest.fn(),
      findSetBySku: jest.fn(),
      save: jest.fn(),
    };
    registry = new BarcodeRegistry(mockRepo);
    dispatcher = new BarcodeScanDispatcher(registry);
  });

  it('should dispatch to the registered handler when scan is resolved', async () => {
    const sku = new Sku('TEST-SKU');
    mockRepo.findSkuByBarcodeValue.mockResolvedValue(sku);

    const mockHandler: IScanHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };

    dispatcher.register(ScanContext.Receiving, mockHandler);

    const payload = { locationId: 'LOC-1' };
    await dispatcher.dispatch('123456789012', ScanContext.Receiving, payload);

    // registry upper-cases and trims
    expect(mockRepo.findSkuByBarcodeValue).toHaveBeenCalledWith('123456789012');
    expect(mockHandler.handle).toHaveBeenCalledWith(sku, '123456789012', payload);
  });

  it('should throw an error if no handler is registered for the context', async () => {
    const sku = new Sku('TEST-SKU');
    mockRepo.findSkuByBarcodeValue.mockResolvedValue(sku);

    await expect(
      dispatcher.dispatch('123456789012', ScanContext.PointOfSale)
    ).rejects.toThrow('No handler registered for scan context: pos');
  });

  it('should throw an error if the barcode cannot be resolved', async () => {
    mockRepo.findSkuByBarcodeValue.mockResolvedValue(null);

    const mockHandler: IScanHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
    dispatcher.register(ScanContext.Receiving, mockHandler);

    await expect(
      dispatcher.dispatch('UNKNOWN', ScanContext.Receiving)
    ).rejects.toThrow('No variant found for barcode: UNKNOWN');

    expect(mockHandler.handle).not.toHaveBeenCalled();
  });

  it('should pass an empty payload if none is provided', async () => {
    const sku = new Sku('TEST-SKU');
    mockRepo.findSkuByBarcodeValue.mockResolvedValue(sku);

    const mockHandler: IScanHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };

    dispatcher.register(ScanContext.CycleCount, mockHandler);

    await dispatcher.dispatch('123456789012', ScanContext.CycleCount);

    expect(mockHandler.handle).toHaveBeenCalledWith(sku, '123456789012', {});
  });
});
