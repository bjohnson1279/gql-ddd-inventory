import { BarcodeRegistry } from '../../../src/domain/services/BarcodeRegistry';
import { IBarcodeRepository } from '../../../src/domain/repositories/IBarcodeRepository';
import { Sku } from '../../../src/domain/valueObjects/Sku';

describe('BarcodeRegistry', () => {
  let mockRepository: jest.Mocked<IBarcodeRepository>;
  let registry: BarcodeRegistry;

  beforeEach(() => {
    mockRepository = {
      findSkuByBarcodeValue: jest.fn(),
      findSetBySku: jest.fn(),
      save: jest.fn()
    } as unknown as jest.Mocked<IBarcodeRepository>;
    registry = new BarcodeRegistry(mockRepository);
  });

  describe('resolve', () => {
    it('should resolve a valid barcode to a Sku, normalizing the input', async () => {
      const sku = new Sku('TEST-SKU');
      mockRepository.findSkuByBarcodeValue.mockResolvedValue(sku);

      const result = await registry.resolve('  123456789012  ');

      expect(mockRepository.findSkuByBarcodeValue).toHaveBeenCalledWith('123456789012');
      expect(result).toBe(sku);
    });

    it('should resolve a valid barcode to a Sku, converting input to uppercase', async () => {
      const sku = new Sku('TEST-SKU');
      mockRepository.findSkuByBarcodeValue.mockResolvedValue(sku);

      const result = await registry.resolve('abc-123');

      expect(mockRepository.findSkuByBarcodeValue).toHaveBeenCalledWith('ABC-123');
      expect(result).toBe(sku);
    });

    it('should throw an error if barcode is not found, normalizing the repository query but preserving the original value in the error message', async () => {
      mockRepository.findSkuByBarcodeValue.mockResolvedValue(null);

      await expect(registry.resolve('  unknown  ')).rejects.toThrow('No variant found for barcode:   unknown  ');
      expect(mockRepository.findSkuByBarcodeValue).toHaveBeenCalledWith('UNKNOWN');
    });
  });

  describe('isRegistered', () => {
    it('should return true if barcode is registered, normalizing the input', async () => {
      const sku = new Sku('TEST-SKU');
      mockRepository.findSkuByBarcodeValue.mockResolvedValue(sku);

      const result = await registry.isRegistered('  123456789012  ');

      expect(mockRepository.findSkuByBarcodeValue).toHaveBeenCalledWith('123456789012');
      expect(result).toBe(true);
    });

    it('should return true if barcode is registered, converting input to uppercase', async () => {
      const sku = new Sku('TEST-SKU');
      mockRepository.findSkuByBarcodeValue.mockResolvedValue(sku);

      const result = await registry.isRegistered('abc-123');

      expect(mockRepository.findSkuByBarcodeValue).toHaveBeenCalledWith('ABC-123');
      expect(result).toBe(true);
    });

    it('should return false if barcode is not registered', async () => {
      mockRepository.findSkuByBarcodeValue.mockResolvedValue(null);

      const result = await registry.isRegistered('UNKNOWN');

      expect(mockRepository.findSkuByBarcodeValue).toHaveBeenCalledWith('UNKNOWN');
      expect(result).toBe(false);
    });
  });
});
