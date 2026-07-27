import {
  UpdateShipmentStatusUseCase,
  IShipmentRepository,
  IEventDispatcher,
} from '../../../src/application/useCases/ManageShipping';

describe('UpdateShipmentStatusUseCase', () => {
  let mockShipmentRepository: jest.Mocked<IShipmentRepository>;
  let mockEventDispatcher: jest.Mocked<IEventDispatcher>;
  let useCase: UpdateShipmentStatusUseCase;

  beforeEach(() => {
    mockShipmentRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockEventDispatcher = {};

    useCase = new UpdateShipmentStatusUseCase(
      mockShipmentRepository,
      mockEventDispatcher
    );
  });

  it('should call shipmentRepository.update with correct id and status', async () => {
    const shipmentId = 'ship-123';
    const status = 'DELIVERED';

    const result = await useCase.execute(shipmentId, status);

    expect(mockShipmentRepository.update).toHaveBeenCalledTimes(1);
    expect(mockShipmentRepository.update).toHaveBeenCalledWith({
      id: shipmentId,
      status: status,
    });
    expect(result).toBe(true);
  });
});
