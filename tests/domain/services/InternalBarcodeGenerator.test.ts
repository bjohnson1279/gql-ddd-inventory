import { InternalBarcodeGenerator } from '../../../src/domain/services/InternalBarcodeGenerator';
import { BarcodeRegistry } from '../../../src/domain/services/BarcodeRegistry';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { BarcodeSymbology } from '../../../src/domain/enums/BarcodeEnums';

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
  });
});
