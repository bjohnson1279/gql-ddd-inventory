import {
  AssignBarcodeUseCase,
  AssignBarcodeInput,
  RevokeBarcodeUseCase,
  GenerateInternalBarcodeUseCase,
  POSScanHandler,
  ReceivingScanHandler,
  CycleCountScanHandler
} from '../../../src/application/useCases/ManageBarcodes';
import { IBarcodeRepository } from '../../../src/domain/repositories/IBarcodeRepository';
import { VariantBarcodeSet } from '../../../src/domain/entities/VariantBarcodeSet';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { BarcodeSymbology, BarcodeSource } from '../../../src/domain/enums/BarcodeEnums';
import { BarcodeAssignmentId } from '../../../src/domain/valueObjects/BarcodeAssignmentId';

describe('ManageBarcodes Use Cases', () => {
  let barcodeRepo: jest.Mocked<IBarcodeRepository>;

  beforeEach(() => {
    barcodeRepo = {
      findSkuByBarcodeValue: jest.fn(),
      findSetBySku: jest.fn(),
      findAllAssignments: jest.fn(),
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

  describe('RevokeBarcodeUseCase', () => {
    it('throws an error if product variant set is not found', async () => {
      const useCase = new RevokeBarcodeUseCase(barcodeRepo);
      barcodeRepo.findSetBySku.mockResolvedValue(null);

      await expect(useCase.execute({ sku: 'NO-SKU', assignmentId: 'A1' })).rejects.toThrow(
        'ProductVariant not found for SKU: NO-SKU'
      );
    });

    it('successfully revokes a barcode assignment', async () => {
      const useCase = new RevokeBarcodeUseCase(barcodeRepo);
      const mockSet = new VariantBarcodeSet(new Sku('SKU1'));
      const barcode = new (require('../../../src/domain/valueObjects/Barcode').Barcode)(BarcodeSymbology.CODE_128, 'B1');
      const assignment = mockSet.assign(barcode, BarcodeSource.Internal);

      barcodeRepo.findSetBySku.mockResolvedValue(mockSet);
      barcodeRepo.save.mockResolvedValue(undefined);

      const result = await useCase.execute({ sku: 'SKU1', assignmentId: assignment.id.value });
      expect(result).toBe(true);
      expect(mockSet.all).toHaveLength(0);
      expect(barcodeRepo.save).toHaveBeenCalledWith(mockSet);
    });
  });

  describe('GenerateInternalBarcodeUseCase', () => {
    it('throws an error if product variant set is not found', async () => {
      const mockGenerator = { generate: jest.fn() } as any;
      const useCase = new GenerateInternalBarcodeUseCase(barcodeRepo, mockGenerator);
      barcodeRepo.findSetBySku.mockResolvedValue(null);

      await expect(useCase.execute('NO-SKU', 'T1')).rejects.toThrow(
        'ProductVariant not found for SKU: NO-SKU'
      );
    });

    it('successfully generates and assigns an internal barcode', async () => {
      const generated = new (require('../../../src/domain/valueObjects/Barcode').Barcode)(BarcodeSymbology.CODE_128, 'INT-123');
      const mockGenerator = { generate: jest.fn().mockResolvedValue(generated) } as any;
      const useCase = new GenerateInternalBarcodeUseCase(barcodeRepo, mockGenerator);
      const mockSet = new VariantBarcodeSet(new Sku('SKU1'));

      barcodeRepo.findSetBySku.mockResolvedValue(mockSet);
      barcodeRepo.save.mockResolvedValue(undefined);

      const result = await useCase.execute('SKU1', 'T1');
      expect(result).toBe('INT-123');
      expect(mockSet.all).toHaveLength(1);
      expect(mockSet.all[0].barcode.value).toBe('INT-123');
      expect(barcodeRepo.save).toHaveBeenCalledWith(mockSet);
    });
  });

  describe('Scan Handlers', () => {
    describe('POSScanHandler', () => {
      it('throws error if locationId is missing from payload', async () => {
        const mockUseCase = { execute: jest.fn() } as any;
        const handler = new POSScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await expect(handler.handle(sku, 'B1', {})).rejects.toThrow(
          'locationId is required for POS scan dispatch.'
        );
      });

      it('calls dispatchStockUseCase if locationId is present', async () => {
        const mockUseCase = { execute: jest.fn().mockResolvedValue({}) } as any;
        const handler = new POSScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await handler.handle(sku, 'B1', { locationId: 'LOC1', amount: 3 });
        expect(mockUseCase.execute).toHaveBeenCalledWith('SKU1', 'LOC1', 3);
      });
    });

    describe('ReceivingScanHandler', () => {
      it('throws error if locationId is missing from payload', async () => {
        const mockUseCase = { execute: jest.fn() } as any;
        const handler = new ReceivingScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await expect(handler.handle(sku, 'B1', {})).rejects.toThrow(
          'locationId is required for Receiving scan dispatch.'
        );
      });

      it('calls receiveStockUseCase if locationId is present', async () => {
        const mockUseCase = { execute: jest.fn().mockResolvedValue({}) } as any;
        const handler = new ReceivingScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await handler.handle(sku, 'B1', { locationId: 'LOC1', amount: 5 });
        expect(mockUseCase.execute).toHaveBeenCalledWith('SKU1', 'LOC1', 5);
      });
    });

    describe('CycleCountScanHandler', () => {
      it('throws error if locationId is missing from payload', async () => {
        const mockUseCase = { execute: jest.fn() } as any;
        const handler = new CycleCountScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await expect(handler.handle(sku, 'B1', { actualQuantity: 10 })).rejects.toThrow(
          'locationId is required for CycleCount scan dispatch.'
        );
      });

      it('throws error if actualQuantity is missing from payload', async () => {
        const mockUseCase = { execute: jest.fn() } as any;
        const handler = new CycleCountScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await expect(handler.handle(sku, 'B1', { locationId: 'LOC1' })).rejects.toThrow(
          'actualQuantity is required for CycleCount scan dispatch.'
        );
      });

      it('calls submitInventoryCountUseCase if locationId and actualQuantity are present', async () => {
        const mockUseCase = { execute: jest.fn().mockResolvedValue({}) } as any;
        const handler = new CycleCountScanHandler(mockUseCase);
        const sku = new Sku('SKU1');

        await handler.handle(sku, 'B1', { locationId: 'LOC1', actualQuantity: 20 });
        expect(mockUseCase.execute).toHaveBeenCalledWith([
          { sku: 'SKU1', locationId: 'LOC1', actualQuantity: 20 }
        ]);
      });
    });
  });
});
