import { GenerateInternalBarcodeUseCase } from '../../../src/application/useCases/ManageBarcodes';
import { IBarcodeRepository } from '../../../src/domain/repositories/IBarcodeRepository';
import { InternalBarcodeGenerator } from '../../../src/domain/services/InternalBarcodeGenerator';
import { BarcodeRegistry } from '../../../src/domain/services/BarcodeRegistry';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { Barcode } from '../../../src/domain/valueObjects/Barcode';
import { BarcodeSymbology, BarcodeSource } from '../../../src/domain/enums/BarcodeEnums';
import { VariantBarcodeSet } from '../../../src/domain/entities/VariantBarcodeSet';

describe('GenerateInternalBarcodeUseCase', () => {
  let barcodeRepo: jest.Mocked<IBarcodeRepository>;
  let barcodeRegistry: jest.Mocked<BarcodeRegistry>;
  let generator: jest.Mocked<InternalBarcodeGenerator>;
  let useCase: GenerateInternalBarcodeUseCase;

  beforeEach(() => {
    barcodeRepo = {
      findSkuByBarcodeValue: jest.fn(),
      findSetBySku: jest.fn(),
      save: jest.fn(),
    };

    barcodeRegistry = {
      resolve: jest.fn(),
      isRegistered: jest.fn(),
    } as any;

    generator = {
      generate: jest.fn(),
    } as any;

    useCase = new GenerateInternalBarcodeUseCase(barcodeRepo, generator);
  });

  it('should successfully generate and assign an internal barcode', async () => {
    const sku = new Sku('TEST-SKU');
    const tenantIdStr = 'T1';
    const generatedBarcode = new Barcode(BarcodeSymbology.CODE_128, 'INV-T1-TEST');

    const barcodeSet = new VariantBarcodeSet(sku);
    jest.spyOn(barcodeSet, 'assign');

    barcodeRepo.findSetBySku.mockResolvedValue(barcodeSet);
    generator.generate.mockResolvedValue(generatedBarcode);

    const result = await useCase.execute('TEST-SKU', tenantIdStr);

    expect(barcodeRepo.findSetBySku).toHaveBeenCalledWith(expect.any(Sku));
    expect(barcodeRepo.findSetBySku.mock.calls[0][0].value).toBe('TEST-SKU');

    expect(generator.generate).toHaveBeenCalledWith(expect.any(Sku), expect.any(TenantId));
    expect(generator.generate.mock.calls[0][0].value).toBe('TEST-SKU');
    expect(generator.generate.mock.calls[0][1].value).toBe(tenantIdStr);

    expect(barcodeSet.assign).toHaveBeenCalledWith(generatedBarcode, BarcodeSource.Internal, false);
    expect(barcodeRepo.save).toHaveBeenCalledWith(barcodeSet);

    expect(result).toBe('INV-T1-TEST');
  });

  it('should throw an error if the ProductVariant (VariantBarcodeSet) is not found', async () => {
    barcodeRepo.findSetBySku.mockResolvedValue(null);

    await expect(useCase.execute('MISSING-SKU', 'T1')).rejects.toThrow(
      'ProductVariant not found for SKU: MISSING-SKU'
    );

    expect(barcodeRepo.findSetBySku).toHaveBeenCalled();
    expect(generator.generate).not.toHaveBeenCalled();
    expect(barcodeRepo.save).not.toHaveBeenCalled();
  });
});
