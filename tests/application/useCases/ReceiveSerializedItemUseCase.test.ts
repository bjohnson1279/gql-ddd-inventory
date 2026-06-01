import { ReceiveSerializedItemUseCase } from '../../../src/application/useCases/ManageSerializedItems';
import { SerializedInventoryService } from '../../../src/domain/services/SerializedInventoryService';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

describe('ReceiveSerializedItemUseCase', () => {
  let mockSerializedInventoryService: jest.Mocked<SerializedInventoryService>;
  let mockSerialsRepo: jest.Mocked<ISerializedItemRepository>;

  beforeEach(() => {
    mockSerializedInventoryService = {
      register: jest.fn(),
      receive: jest.fn(),
      sell: jest.fn(),
    } as any;

    mockSerialsRepo = {
      isRegistered: jest.fn(),
      save: jest.fn(),
      findBySerial: jest.fn(),
      findByVariant: jest.fn(),
    } as any;
  });

  const validProps = {
    variantId: 'variant-1',
    serialNumber: 'SN-12345',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    actorId: 'actor-1',
    purchaseOrderId: 'PO-987',
    unitCostCents: 1500,
  };

  it('should register and receive the item if it is not registered yet', async () => {
    mockSerialsRepo.isRegistered.mockResolvedValue(false);

    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    const result = await useCase.execute(validProps);

    expect(result).toBe(true);
    expect(mockSerialsRepo.isRegistered).toHaveBeenCalledWith(
      new SerialNumber('SN-12345'),
      new TenantId('tenant-1')
    );
    expect(mockSerializedInventoryService.register).toHaveBeenCalledWith(
      new SerialNumber('SN-12345'),
      new ProductVariantId('variant-1'),
      new TenantId('tenant-1'),
      new LocationId('location-1'),
      new ActorId('actor-1')
    );
    expect(mockSerializedInventoryService.receive).toHaveBeenCalledWith(
      new SerialNumber('SN-12345'),
      new TenantId('tenant-1'),
      new LocationId('location-1'),
      'PO-987',
      1500,
      new ActorId('actor-1')
    );
  });

  it('should only receive the item if it is already registered', async () => {
    mockSerialsRepo.isRegistered.mockResolvedValue(true);

    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    const result = await useCase.execute(validProps);

    expect(result).toBe(true);
    expect(mockSerialsRepo.isRegistered).toHaveBeenCalledWith(
      new SerialNumber('SN-12345'),
      new TenantId('tenant-1')
    );
    expect(mockSerializedInventoryService.register).not.toHaveBeenCalled();
    expect(mockSerializedInventoryService.receive).toHaveBeenCalledWith(
      new SerialNumber('SN-12345'),
      new TenantId('tenant-1'),
      new LocationId('location-1'),
      'PO-987',
      1500,
      new ActorId('actor-1')
    );
  });

  it('should throw an error if the serial number is invalid', async () => {
    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    const input = {
      ...validProps,
      serialNumber: '', // Invalid empty serial number
    };

    await expect(useCase.execute(input)).rejects.toThrow('Serial number cannot be empty.');
    expect(mockSerialsRepo.isRegistered).not.toHaveBeenCalled();
  });

  it('should throw an error if the location ID is invalid', async () => {
    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    const input = {
      ...validProps,
      locationId: '   ', // Invalid empty location
    };

    await expect(useCase.execute(input)).rejects.toThrow('LocationId cannot be empty.');
  });

  it('should propagate errors from the repository isRegistered method', async () => {
    mockSerialsRepo.isRegistered.mockRejectedValue(new Error('Database connection failed.'));

    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    await expect(useCase.execute(validProps)).rejects.toThrow('Database connection failed.');
    expect(mockSerializedInventoryService.register).not.toHaveBeenCalled();
    expect(mockSerializedInventoryService.receive).not.toHaveBeenCalled();
  });

  it('should propagate errors from the service register method', async () => {
    mockSerialsRepo.isRegistered.mockResolvedValue(false);
    mockSerializedInventoryService.register.mockRejectedValue(new Error('Item already registered differently.'));

    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    await expect(useCase.execute(validProps)).rejects.toThrow('Item already registered differently.');
    expect(mockSerializedInventoryService.receive).not.toHaveBeenCalled();
  });

  it('should propagate errors from the service receive method', async () => {
    mockSerialsRepo.isRegistered.mockResolvedValue(true);
    mockSerializedInventoryService.receive.mockRejectedValue(new Error('Item is quarantined.'));

    const useCase = new ReceiveSerializedItemUseCase(
      mockSerializedInventoryService,
      mockSerialsRepo
    );

    await expect(useCase.execute(validProps)).rejects.toThrow('Item is quarantined.');
  });
});
