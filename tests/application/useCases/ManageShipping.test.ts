import { GetShipmentsUseCase, IShipmentRepository } from '../../../src/application/useCases/ManageShipping';

describe('ManageShipping Use Cases', () => {
  describe('GetShipmentsUseCase', () => {
    let mockShipmentRepository: jest.Mocked<IShipmentRepository>;

    beforeEach(() => {
      mockShipmentRepository = {
        save: jest.fn(),
        findById: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
      };
    });

    it('should call findAll on the repository', async () => {
      mockShipmentRepository.findAll.mockResolvedValue([]);

      const useCase = new GetShipmentsUseCase(mockShipmentRepository);
      await useCase.execute();

      expect(mockShipmentRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return the data returned by findAll', async () => {
      const mockShipments = [{ id: 'ship-1', status: 'shipped' }, { id: 'ship-2', status: 'pending' }];
      mockShipmentRepository.findAll.mockResolvedValue(mockShipments);

      const useCase = new GetShipmentsUseCase(mockShipmentRepository);
      const result = await useCase.execute();

      expect(result).toEqual(mockShipments);
    });

    it('should propagate errors thrown by findAll', async () => {
      const dbError = new Error('Database connection failed');
      mockShipmentRepository.findAll.mockRejectedValue(dbError);

      const useCase = new GetShipmentsUseCase(mockShipmentRepository);

      await expect(useCase.execute()).rejects.toThrow('Database connection failed');
      expect(mockShipmentRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
