import { ReceiveRmaUseCase, AuthorizeRmaUseCase, ResolveQuarantineItemUseCase } from '../../../src/application/useCases/ManageReturns';
import { IRmaRepository } from '../../../src/domain/repositories/IRmaRepository';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { IQuarantineRepository } from '../../../src/domain/repositories/IQuarantineRepository';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';

describe('ManageReturns Use Cases', () => {
  describe('ReceiveRmaUseCase', () => {
    let mockRmaRepo: jest.Mocked<IRmaRepository>;
    let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
    let mockCostLayerRepo: jest.Mocked<IInventoryCostLayerRepository>;
    let mockQuarantineRepo: jest.Mocked<IQuarantineRepository>;
    let mockJournalRepo: jest.Mocked<IJournalRepository>;
    let mockProductRepo: jest.Mocked<IProductRepository>;
    let mockSerializedItemRepo: jest.Mocked<ISerializedItemRepository>;

    beforeEach(() => {
      mockRmaRepo = {
        save: jest.fn(),
        findById: jest.fn(),
        findByNumber: jest.fn(),
        findAllByTenant: jest.fn(),
      } as unknown as jest.Mocked<IRmaRepository>;

      mockInventoryRepo = {} as unknown as jest.Mocked<IInventoryRepository>;
      mockCostLayerRepo = {} as unknown as jest.Mocked<IInventoryCostLayerRepository>;
      mockQuarantineRepo = {} as unknown as jest.Mocked<IQuarantineRepository>;
      mockJournalRepo = {} as unknown as jest.Mocked<IJournalRepository>;
      mockProductRepo = {} as unknown as jest.Mocked<IProductRepository>;
      mockSerializedItemRepo = {} as unknown as jest.Mocked<ISerializedItemRepository>;
    });

    it('should throw an error for ReceiveRmaUseCase with invalid RMA ID', async () => {
      mockRmaRepo.findById.mockResolvedValue(null);

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepo,
        mockSerializedItemRepo
      );

      const dto = {
        rmaId: 'invalid-id',
        items: []
      };

      await expect(useCase.execute(dto)).rejects.toThrow('RMA with ID invalid-id not found.');
    });
    it('should throw an error if SKU is not found for variant ID', async () => {
      mockRmaRepo.findById.mockResolvedValue({
        locationId: { value: 'LOC-1' }
      } as any);

      const mockProductRepoWithEmptyMap = {
        findSkusByVariantIds: jest.fn().mockResolvedValue(new Map())
      } as unknown as jest.Mocked<IProductRepository>;

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepoWithEmptyMap,
        mockSerializedItemRepo
      );

      const dto = {
        rmaId: 'valid-rma-id',
        items: [{ variantId: 'invalid-variant', quantityReceived: 1, disposition: 'RESTOCK' as any }]
      };

      await expect(useCase.execute(dto)).rejects.toThrow('SKU not found for variant ID invalid-variant');
    });

    it('should throw an error if item is not found in RMA', async () => {
      mockRmaRepo.findById.mockResolvedValue({
        locationId: { value: 'LOC-1' },
        items: []
      } as any);

      const skuMap = new Map();
      skuMap.set('missing-variant', 'SKU-123');
      const mockProductRepoWithMap = {
        findSkusByVariantIds: jest.fn().mockResolvedValue(skuMap)
      } as unknown as jest.Mocked<IProductRepository>;

      const mockInventoryRepoBatch = {
        findBySkuAndLocationBatch: jest.fn().mockResolvedValue([])
      } as unknown as jest.Mocked<IInventoryRepository>;

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepoBatch,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepoWithMap,
        mockSerializedItemRepo
      );

      const dto = {
        rmaId: 'valid-rma-id',
        items: [{ variantId: 'missing-variant', quantityReceived: 1, disposition: 'RESTOCK' as any }]
      };

      await expect(useCase.execute(dto)).rejects.toThrow('Item with variant ID missing-variant not found in RMA.');
    });

  });

  describe('AuthorizeRmaUseCase', () => {
    it('should throw an error if RMA is not found', async () => {
      const mockRmaRepo = {
        findById: jest.fn().mockResolvedValue(null)
      } as unknown as jest.Mocked<IRmaRepository>;

      const useCase = new AuthorizeRmaUseCase(mockRmaRepo);
      await expect(useCase.execute('invalid-id')).rejects.toThrow('RMA with ID invalid-id not found.');
    });
  });

  describe('ResolveQuarantineItemUseCase', () => {
    it('should throw an error if quarantine item is not found', async () => {
      const mockQuarantineRepo = {
        findById: jest.fn().mockResolvedValue(null)
      } as unknown as jest.Mocked<IQuarantineRepository>;

      const mockInventoryRepo = {} as unknown as jest.Mocked<IInventoryRepository>;
      const mockCostLayerRepo = {} as unknown as jest.Mocked<IInventoryCostLayerRepository>;
      const mockJournalRepo = {} as unknown as jest.Mocked<IJournalRepository>;
      const mockProductRepo = {} as unknown as jest.Mocked<IProductRepository>;

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      const dto = { quarantineItemId: 'invalid-id' } as any;
      await expect(useCase.execute(dto)).rejects.toThrow('Quarantine item with ID invalid-id not found.');
    });
  });

});
