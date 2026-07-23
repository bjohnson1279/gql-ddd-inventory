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
import {
  CalculateShippingRatesUseCase,
  PurchaseShippingLabelUseCase,
  UpdateShipmentStatusUseCase,
  GetShipmentsUseCase,
  ICarrierService,
  IShipmentRepository,
  IInventoryRepository,
  IAccountingJournalService,
  IEventDispatcher,
} from '../../../src/application/useCases/ManageShipping';

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
    mockInventoryRepository = {}; // No methods defined in the interface for now
    mockAccountingJournalService = {}; // No methods defined in the interface for now
    mockEventDispatcher = {}; // No methods defined in the interface for now
  });

  describe('CalculateShippingRatesUseCase', () => {
    it('should delegate getRates to carrierService and return rates', async () => {
      const useCase = new CalculateShippingRatesUseCase(mockCarrierService);
      const sku = 'SKU-123';
      const qty = 5;
      const dest = '123 Main St';
      const expectedRates = [{ carrier: 'FedEx', rate: 10.5 }];

      mockCarrierService.getRates.mockResolvedValue(expectedRates);

      const result = await useCase.execute(sku, qty, dest);

      expect(mockCarrierService.getRates).toHaveBeenCalledWith(sku, qty, dest);
      expect(result).toBe(expectedRates);

    it('should throw an error if carrierService throws an error', async () => {
      const error = new Error('Carrier API error');

      mockCarrierService.getRates.mockRejectedValue(error);

      await expect(useCase.execute(sku, qty, dest)).rejects.toThrow('Carrier API error');

  describe('PurchaseShippingLabelUseCase', () => {
    it('should delegate purchaseLabel to carrierService and return label', async () => {
      const useCase = new PurchaseShippingLabelUseCase(
        mockShipmentRepository,
        mockCarrierService,
        mockInventoryRepository,
        mockAccountingJournalService,
        mockEventDispatcher
      );
      const input = { shipmentId: 'SHIP-123', packageWeight: 2.5 };
      const expectedLabel = { trackingNumber: 'TRACK-123', labelUrl: 'http://label.url' };

      mockCarrierService.purchaseLabel.mockResolvedValue(expectedLabel);

      const result = await useCase.execute(input);

      expect(mockCarrierService.purchaseLabel).toHaveBeenCalledWith(input);
      expect(result).toBe(expectedLabel);

    it('should throw an error if carrierService throws an error during purchase', async () => {
      const error = new Error('Failed to purchase label');

      mockCarrierService.purchaseLabel.mockRejectedValue(error);

      await expect(useCase.execute(input)).rejects.toThrow('Failed to purchase label');

    it('should update shipment status using repository and return true', async () => {
      const useCase = new UpdateShipmentStatusUseCase(mockShipmentRepository, mockEventDispatcher);
      const id = 'SHIP-123';

      mockShipmentRepository.update.mockResolvedValue(undefined);


      expect(mockShipmentRepository.update).toHaveBeenCalledWith({ id, status });

    it('should propagate repository errors when updating status fails', async () => {
      const error = new Error('Database connection failed');

      mockShipmentRepository.update.mockRejectedValue(error);

      await expect(useCase.execute(id, status)).rejects.toThrow('Database connection failed');

  describe('GetShipmentsUseCase', () => {
    it('should retrieve all shipments using repository', async () => {
      const useCase = new GetShipmentsUseCase(mockShipmentRepository);
      const expectedShipments = [{ id: 'SHIP-123', status: 'PENDING' }, { id: 'SHIP-124', status: 'SHIPPED' }];

      mockShipmentRepository.findAll.mockResolvedValue(expectedShipments);

      const result = await useCase.execute();

      expect(mockShipmentRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedShipments);

    it('should propagate repository errors when fetching shipments fails', async () => {
      const error = new Error('Table not found');

      mockShipmentRepository.findAll.mockRejectedValue(error);

      await expect(useCase.execute()).rejects.toThrow('Table not found');
  });
});
