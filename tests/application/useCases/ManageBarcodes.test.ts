import { AssignBarcodeUseCase, AssignBarcodeInput } from '../../../src/application/useCases/ManageBarcodes';
import { IBarcodeRepository } from '../../../src/domain/repositories/IBarcodeRepository';
import { VariantBarcodeSet } from '../../../src/domain/entities/VariantBarcodeSet';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { BarcodeSymbology, BarcodeSource } from '../../../src/domain/enums/BarcodeEnums';

describe('ManageBarcodes Use Cases', () => {
  let barcodeRepo: jest.Mocked<IBarcodeRepository>;

  beforeEach(() => {
    barcodeRepo = {
      findSkuByBarcodeValue: jest.fn(),
      findSetBySku: jest.fn(),
      save: jest.fn(),
    };
  });

  describe('AssignBarcodeUseCase', () => {
    let useCase: AssignBarcodeUseCase;

    beforeEach(() => {
      useCase = new AssignBarcodeUseCase(barcodeRepo);
    });

    it('throws an error if product variant set is not found', async () => {
      const input: AssignBarcodeInput = {
        sku: 'SKU-NOT-FOUND',
        barcodeValue: '123456789012',
        symbology: BarcodeSymbology.UPC_A,
        source: BarcodeSource.Internal,
      };

      barcodeRepo.findSetBySku.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(
        'ProductVariant not found for SKU: SKU-NOT-FOUND'
      );

      expect(barcodeRepo.findSetBySku).toHaveBeenCalledWith(expect.any(Sku));
      expect(barcodeRepo.findSetBySku).toHaveBeenCalledTimes(1);
      expect(barcodeRepo.save).not.toHaveBeenCalled();
    });

    it('throws error when repository returns null for a given SKU', async () => {
      const input: AssignBarcodeInput = {
        sku: 'MISSING-SKU',
        barcodeValue: '123456789012',
        symbology: BarcodeSymbology.UPC_A,
        source: BarcodeSource.Internal,
      };

      barcodeRepo.findSetBySku.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(
        'ProductVariant not found for SKU: MISSING-SKU'
      );

      expect(barcodeRepo.findSetBySku).toHaveBeenCalledWith(expect.any(Sku));
      expect(barcodeRepo.save).not.toHaveBeenCalled();
    });

    it('mocks the repository to return null and asserts the specific error is thrown', async () => {
      const input: AssignBarcodeInput = {
        sku: 'MISSING-SKU-TEST',
        barcodeValue: '123456789012',
        symbology: BarcodeSymbology.UPC_A,
        source: BarcodeSource.Internal,
      };

      barcodeRepo.findSetBySku.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(
        'ProductVariant not found for SKU: MISSING-SKU-TEST'
      );

      expect(barcodeRepo.findSetBySku).toHaveBeenCalledWith(expect.any(Sku));
      expect(barcodeRepo.findSetBySku).toHaveBeenCalledTimes(1);
      expect(barcodeRepo.save).not.toHaveBeenCalled();
    });

    it('successfully assigns a barcode when product variant set is found', async () => {
      const input: AssignBarcodeInput = {
        sku: 'SKU-FOUND',
        barcodeValue: '123456789012',
        symbology: BarcodeSymbology.UPC_A,
        source: BarcodeSource.Internal,
        makePrimary: true,
      };

      const mockSet = new VariantBarcodeSet(new Sku(input.sku));
      jest.spyOn(mockSet, 'assign');

      barcodeRepo.findSetBySku.mockResolvedValue(mockSet);
      barcodeRepo.save.mockResolvedValue(undefined);

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(barcodeRepo.findSetBySku).toHaveBeenCalledWith(expect.any(Sku));
      expect(mockSet.assign).toHaveBeenCalledTimes(1);
      expect(barcodeRepo.save).toHaveBeenCalledWith(mockSet);
      expect(barcodeRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
