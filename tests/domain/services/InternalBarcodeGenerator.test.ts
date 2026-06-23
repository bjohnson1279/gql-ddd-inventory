import { InternalBarcodeGenerator } from '../../../src/domain/services/InternalBarcodeGenerator';
import { BarcodeRegistry } from '../../../src/domain/services/BarcodeRegistry';
import { IBarcodeRepository } from '../../../src/domain/repositories/IBarcodeRepository';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';

describe('InternalBarcodeGenerator', () => {
  let mockRegistry: jest.Mocked<BarcodeRegistry>;
  let generator: InternalBarcodeGenerator;
  const sku = new Sku('TEST-SKU-1');
  const tenantId = new TenantId('tenant-123');

  beforeEach(() => {
    const mockRepo = {} as unknown as jest.Mocked<IBarcodeRepository>;
    mockRegistry = new BarcodeRegistry(mockRepo) as jest.Mocked<BarcodeRegistry>;

    // We override isRegistered with a jest mock function to control its behavior
    mockRegistry.isRegistered = jest.fn();

    generator = new InternalBarcodeGenerator(mockRegistry);
  });

  describe('generate', () => {
    it('should generate a unique barcode successfully on the first attempt', async () => {
      // Simulate that the barcode is NOT registered yet
      mockRegistry.isRegistered.mockResolvedValue(false);

      const result = await generator.generate(sku, tenantId);

      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(1);
      expect(result.symbology).toBe('code_128');
      expect(result.value).toMatch(/^INV-[A-F0-9]{4}-[A-F0-9]{8}$/);
    });

    it('should generate a unique barcode successfully after multiple attempts', async () => {
      // Simulate that the first 2 barcodes are registered, but the 3rd is free
      mockRegistry.isRegistered
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await generator.generate(sku, tenantId);

      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(3);
      expect(result.symbology).toBe('code_128');
      expect(result.value).toMatch(/^INV-[A-F0-9]{4}-[A-F0-9]{8}$/);
    });

    it('should throw an error if it cannot generate a unique barcode after 5 attempts', async () => {
      // Simulate that the barcode is always registered (collision limit)
      mockRegistry.isRegistered.mockResolvedValue(true);

      await expect(generator.generate(sku, tenantId)).rejects.toThrow('Could not generate a unique barcode after 5 attempts.');

      // It should have tried exactly 6 times (0, 1, 2, 3, 4, 5) -> attempts becomes 6, > 5 check triggers
      // Wait, let's see the code:
      // do { value = build(); attempts++; if (attempts > 5) throw ... } while(await isRegistered(value))
      // attempt 0: value=..., attempts=1, if(1 > 5) false, while(await isReg) -> true
      // attempt 1: value=..., attempts=2, if(2 > 5) false, while(await isReg) -> true
      // attempt 2: value=..., attempts=3, if(3 > 5) false, while(await isReg) -> true
      // attempt 3: value=..., attempts=4, if(4 > 5) false, while(await isReg) -> true
      // attempt 4: value=..., attempts=5, if(5 > 5) false, while(await isReg) -> true
      // attempt 5: value=..., attempts=6, if(6 > 5) throws Error!
      // So isRegistered is called 5 times.
      expect(mockRegistry.isRegistered).toHaveBeenCalledTimes(5);
    });
  });
});
