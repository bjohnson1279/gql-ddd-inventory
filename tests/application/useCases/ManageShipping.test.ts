import { UpdateShipmentStatusUseCase, IShipmentRepository, IEventDispatcher } from '../../../src/application/useCases/ManageShipping';

describe('ManageShipping Use Cases', () => {
  describe('UpdateShipmentStatusUseCase', () => {
    let mockShipmentRepo: jest.Mocked<IShipmentRepository>;
    let mockEventDispatcher: jest.Mocked<IEventDispatcher>;
    let useCase: UpdateShipmentStatusUseCase;

    beforeEach(() => {
      mockShipmentRepo = {
        save: jest.fn(),
        findById: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockEventDispatcher = {} as unknown as IEventDispatcher; // No methods currently needed in IEventDispatcher for this use case

      useCase = new UpdateShipmentStatusUseCase(mockShipmentRepo, mockEventDispatcher);
    });

    it('should call shipmentRepository.update with correct arguments and return true', async () => {
      const id = 'shipment-123';
      const status = 'SHIPPED';

      const result = await useCase.execute(id, status);

      expect(mockShipmentRepo.update).toHaveBeenCalledTimes(1);
      expect(mockShipmentRepo.update).toHaveBeenCalledWith({ id, status });
      expect(result).toBe(true);
    });
  });
});
