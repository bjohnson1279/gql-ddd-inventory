import { InternalBarcodeGenerator } from '../../../src/domain/services/InternalBarcodeGenerator';
import { BarcodeRegistry } from '../../../src/domain/services/BarcodeRegistry';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { BarcodeSymbology } from '../../../src/domain/enums/BarcodeEnums';
import { IBarcodeRepository } from '../../../src/domain/repositories/IBarcodeRepository';

describe('InternalBarcodeGenerator', () => {
  let mockRegistry: jest.Mocked<BarcodeRegistry>;
  let generator: InternalBarcodeGenerator;
  const sku = new Sku('TEST-SKU-123');
  const tenantId = new TenantId('tenant-1');

  beforeEach(() => {
    mockRegistry = {
      resolve: jest.fn(),
      isRegistered: jest.fn(),
    } as unknown as jest.Mocked<BarcodeRegistry>;

    generator = new InternalBarcodeGenerator(mockRegistry);
  });

  describe('generate', () => {
    it('should generate a unique barcode successfully on the first attempt', async () => {
      // Simulate that the barcode is NOT registered yet
      mockRegistry.isRegistered.mockResolvedValue(false);

      const barcode = await generator.generate(sku, tenantId);

      expect(barcode.symbology).toBe(BarcodeSymbology.CODE_128);
      expect(barcode.value).toMatch(/^INV-[A-F0-9]{4}-[A-F0-9]{8}$/);
      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(1);
    });

    it('should retry generating a barcode if a collision occurs', async () => {
      mockRegistry.isRegistered
        .mockResolvedValueOnce(true) // First attempt collision
        .mockResolvedValueOnce(false); // Second attempt success

      const barcode = await generator.generate(sku, tenantId);

      expect(barcode.symbology).toBe(BarcodeSymbology.CODE_128);
      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(2);

      const firstAttemptValue = mockRegistry.isRegistered.mock.calls[0][0];
      const secondAttemptValue = mockRegistry.isRegistered.mock.calls[1][0];
      expect(firstAttemptValue).not.toBe(secondAttemptValue);
      expect(barcode.value).toBe(secondAttemptValue);
    });

    it('should throw an error if it cannot generate a unique barcode after 5 attempts', async () => {
      mockRegistry.isRegistered.mockResolvedValue(true); // Always collide

      await expect(generator.generate(sku, tenantId)).rejects.toThrow(
        'Could not generate a unique barcode after 5 attempts.'
      );
      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(5);
    });

    it('should produce deterministic hashes for the same input and attempt', async () => {
      mockRegistry.isRegistered.mockResolvedValue(false);

      // Using a different instance to avoid any state sharing, although generator is stateless
      const generator2 = new InternalBarcodeGenerator(mockRegistry);

      const barcode1 = await generator.generate(sku, tenantId);

      // reset the mock to start from attempt 0 again
      mockRegistry.isRegistered.mockResolvedValue(false);
      const barcode2 = await generator2.generate(sku, tenantId);

      expect(barcode1.value).toBe(barcode2.value);
    });

    it('should generate different barcodes for different SKUs', async () => {
      mockRegistry.isRegistered.mockResolvedValue(false);

      const sku1 = new Sku('TEST-SKU-123');
      const sku2 = new Sku('TEST-SKU-456');

      const barcode1 = await generator.generate(sku1, tenantId);
      const barcode2 = await generator.generate(sku2, tenantId);

      expect(barcode1.value).not.toBe(barcode2.value);
    });

    it('should generate different barcodes for different tenants', async () => {
      mockRegistry.isRegistered.mockResolvedValue(false);

      const tenantId1 = new TenantId('tenant-1');
      const tenantId2 = new TenantId('tenant-2');

      const barcode1 = await generator.generate(sku, tenantId1);
      const barcode2 = await generator.generate(sku, tenantId2);

      expect(barcode1.value).not.toBe(barcode2.value);
    });

    it('should generate a unique barcode successfully on the 5th attempt', async () => {
      mockRegistry.isRegistered
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const barcode = await generator.generate(sku, tenantId);
      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(5);
      expect(barcode.symbology).toBe(BarcodeSymbology.CODE_128);

      const lastAttemptValue = mockRegistry.isRegistered.mock.calls[4][0];
      expect(barcode.value).toBe(lastAttemptValue);

      // Verify all attempts had unique values
      const attemptValues = new Set(mockRegistry.isRegistered.mock.calls.map(call => call[0]));
      expect(attemptValues.size).toBe(5);
    });
  });
});
