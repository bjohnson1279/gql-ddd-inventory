import { BarcodeScanDispatcher, ScanContext, IScanHandler } from '../../../src/domain/services/BarcodeScanDispatcher';
import { BarcodeRegistry } from '../../../src/domain/services/BarcodeRegistry';
import { Sku } from '../../../src/domain/valueObjects/Sku';

describe('BarcodeScanDispatcher', () => {
  let mockRegistry: jest.Mocked<BarcodeRegistry>;
  let dispatcher: BarcodeScanDispatcher;
  let mockHandler: jest.Mocked<IScanHandler>;
  let mockRepository: jest.Mocked<IBarcodeRepository>;

  beforeEach(() => {
    mockRepository = {
      findSkuByBarcodeValue: jest.fn(),
      findSetBySku: jest.fn(),
      save: jest.fn()
    } as unknown as jest.Mocked<IBarcodeRepository>;

    mockRegistry = new BarcodeRegistry(mockRepository) as jest.Mocked<BarcodeRegistry>;
    jest.spyOn(mockRegistry, 'resolve');

    dispatcher = new BarcodeScanDispatcher(mockRegistry);

    mockHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('register', () => {
    it('should register a handler for a given context without throwing errors', () => {
      expect(() => {
        dispatcher.register(ScanContext.PointOfSale, mockHandler);
      }).not.toThrow();
    });
  });

  describe('dispatch', () => {
    it('should correctly resolve the sku and call the handler with the right arguments', async () => {
      const rawScan = '123456789012';
      const sku = new Sku('TEST-SKU');
      const payload = { locationId: 'loc-1' };

      mockRegistry.resolve.mockResolvedValue(sku);

      dispatcher.register(ScanContext.Receiving, mockHandler);

      await dispatcher.dispatch(rawScan, ScanContext.Receiving, payload);

      expect(mockRegistry.resolve).toHaveBeenCalledWith(rawScan);
      expect(mockHandler.handle).toHaveBeenCalledWith(sku, rawScan, payload);
    });

    it('should pass an empty payload if no payload is provided', async () => {
      const rawScan = '123456789012';
      const sku = new Sku('TEST-SKU');

      mockRegistry.resolve.mockResolvedValue(sku);

      dispatcher.register(ScanContext.PointOfSale, mockHandler);

      await dispatcher.dispatch(rawScan, ScanContext.PointOfSale);

      expect(mockRegistry.resolve).toHaveBeenCalledWith(rawScan);
      expect(mockHandler.handle).toHaveBeenCalledWith(sku, rawScan, {});
    });

    it('should throw an error if no handler is registered for the context', async () => {
      const rawScan = '123456789012';
      const sku = new Sku('TEST-SKU');

      mockRegistry.resolve.mockResolvedValue(sku);

      await expect(dispatcher.dispatch(rawScan, ScanContext.CycleCount)).rejects.toThrow(
        'No handler registered for scan context: cycle_count'
      );

      expect(mockRegistry.resolve).toHaveBeenCalledWith(rawScan);
      expect(mockHandler.handle).not.toHaveBeenCalled();
    });

    it('should bubble up errors from the BarcodeRegistry', async () => {
      const rawScan = '123456789012';
      const error = new Error('Barcode not found');

      mockRegistry.resolve.mockRejectedValue(error);
      dispatcher.register(ScanContext.TransferOut, mockHandler);

      await expect(dispatcher.dispatch(rawScan, ScanContext.TransferOut)).rejects.toThrow('Barcode not found');

      expect(mockRegistry.resolve).toHaveBeenCalledWith(rawScan);
      expect(mockHandler.handle).not.toHaveBeenCalled();
    });

    it('should bubble up errors from the handler', async () => {
      const rawScan = '123456789012';
      const sku = new Sku('TEST-SKU');
      const error = new Error('Handler failed');

      mockRegistry.resolve = jest.fn().mockResolvedValue(sku);
      mockHandler.handle.mockRejectedValue(error);
      dispatcher.register(ScanContext.TransferIn, mockHandler);

      await expect(dispatcher.dispatch(rawScan, ScanContext.TransferIn)).rejects.toThrow('Handler failed');

      expect(mockRegistry.resolve).toHaveBeenCalledWith(rawScan);
      expect(mockHandler.handle).toHaveBeenCalledWith(sku, rawScan, {});
    });
  });
});
