import {
  CalculateShippingRatesUseCase,
  PurchaseShippingLabelUseCase,
  UpdateShipmentStatusUseCase,
  GetShipmentsUseCase,
  ICarrierService,
  IShipmentRepository,
  IInventoryRepository,
  IAccountingJournalService,
  IEventDispatcher
} from '../../../src/application/useCases/ManageShipping';

describe('ManageShipping Use Cases', () => {
  let mockCarrierService: jest.Mocked<ICarrierService>;
  let mockShipmentRepository: jest.Mocked<IShipmentRepository>;
  let mockInventoryRepository: jest.Mocked<IInventoryRepository>;
  let mockAccountingJournalService: jest.Mocked<IAccountingJournalService>;
  let mockEventDispatcher: jest.Mocked<IEventDispatcher>;

  beforeEach(() => {
    mockCarrierService = {
      getRates: jest.fn(),
      purchaseLabel: jest.fn(),
    };
    mockShipmentRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    };
    mockInventoryRepository = {} as any;
    mockAccountingJournalService = {} as any;
    mockEventDispatcher = {} as any;
  });

  describe('CalculateShippingRatesUseCase', () => {
    it('should delegate to carrierService.getRates', async () => {
      const useCase = new CalculateShippingRatesUseCase(mockCarrierService);
      const rates = [{ rate: 10, carrier: 'UPS' }];
      mockCarrierService.getRates.mockResolvedValue(rates);

      const result = await useCase.execute('SKU1', 2, 'DEST');

      expect(mockCarrierService.getRates).toHaveBeenCalledWith('SKU1', 2, 'DEST');
      expect(result).toEqual(rates);
    });
  });

  describe('PurchaseShippingLabelUseCase', () => {
    it('should delegate purchaseLabel to the carrier service and return the result', async () => {
      const useCase = new PurchaseShippingLabelUseCase(
        mockShipmentRepository,
        mockCarrierService,
        mockInventoryRepository,
        mockAccountingJournalService,
        mockEventDispatcher
      );
      const input = { orderId: '123' };
      const expectedOutput = { labelUrl: 'http://example.com/label.pdf' };
      mockCarrierService.purchaseLabel.mockResolvedValue(expectedOutput);

      const result = await useCase.execute(input);

      expect(mockCarrierService.purchaseLabel).toHaveBeenCalledWith(input);
      expect(result).toEqual(expectedOutput);
    });

    it('should correctly propagate errors from carrierService', async () => {
      const useCase = new PurchaseShippingLabelUseCase(
        mockShipmentRepository,
        mockCarrierService,
        mockInventoryRepository,
        mockAccountingJournalService,
        mockEventDispatcher
      );
      const input = { orderId: '123' };
      mockCarrierService.purchaseLabel.mockRejectedValue(new Error('API Error'));

      await expect(useCase.execute(input)).rejects.toThrow('API Error');
    });
  });

  describe('UpdateShipmentStatusUseCase', () => {
    it('should update the shipment status via repository', async () => {
      const useCase = new UpdateShipmentStatusUseCase(mockShipmentRepository, mockEventDispatcher);
      mockShipmentRepository.update.mockResolvedValue(undefined);

      const result = await useCase.execute('ship1', 'SHIPPED');

      expect(mockShipmentRepository.update).toHaveBeenCalledWith({ id: 'ship1', status: 'SHIPPED' });
      expect(result).toBe(true);
    });
  });

  describe('GetShipmentsUseCase', () => {
    it('should return all shipments from repository', async () => {
      const useCase = new GetShipmentsUseCase(mockShipmentRepository);
      const shipments = [{ id: 'ship1' }];
      mockShipmentRepository.findAll.mockResolvedValue(shipments);

      const result = await useCase.execute();

      expect(mockShipmentRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(shipments);
    });
  });
});
