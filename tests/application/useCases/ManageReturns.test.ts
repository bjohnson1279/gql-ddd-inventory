import { ReceiveRmaUseCase, AuthorizeRmaUseCase } from '../../../src/application/useCases/ManageReturns';
import { IRmaRepository } from '../../../src/domain/repositories/IRmaRepository';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { IQuarantineRepository } from '../../../src/domain/repositories/IQuarantineRepository';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';
import { Rma } from '../../../src/domain/entities/Rma';

describe('ManageReturns Use Cases', () => {

  describe('AuthorizeRmaUseCase', () => {
    let mockRmaRepo: jest.Mocked<IRmaRepository>;

    beforeEach(() => {
      mockRmaRepo = {
        save: jest.fn(),
        findById: jest.fn(),
        findByNumber: jest.fn(),
        findAllByTenant: jest.fn(),
      } as unknown as jest.Mocked<IRmaRepository>;
    });

    it('should throw an error if RMA is not found', async () => {
      mockRmaRepo.findById.mockResolvedValue(null);
      const useCase = new AuthorizeRmaUseCase(mockRmaRepo);
      await expect(useCase.execute('invalid-id')).rejects.toThrow('RMA with ID invalid-id not found.');
    });

    it('should authorize and save the RMA', async () => {
      const mockRma = {
        authorize: jest.fn(),
      } as unknown as Rma;
      mockRmaRepo.findById.mockResolvedValue(mockRma);

      const useCase = new AuthorizeRmaUseCase(mockRmaRepo);
      await useCase.execute('valid-id');

      expect(mockRma.authorize).toHaveBeenCalled();
      expect(mockRmaRepo.save).toHaveBeenCalledWith(mockRma);
    });
  });

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

    it('should throw an error if RMA is not found', async () => {
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
  });
});
