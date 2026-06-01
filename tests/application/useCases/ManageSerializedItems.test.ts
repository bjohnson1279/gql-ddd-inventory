import {
  ReceiveSerializedItemUseCase,
  GetSerializedItemBySerialUseCase
} from '../../../src/application/useCases/ManageSerializedItems';
import { SerializedInventoryService } from '../../../src/domain/services/SerializedInventoryService';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

describe('ManageSerializedItems', () => {
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

  describe('ReceiveSerializedItemUseCase', () => {
    it('should register and receive the item if it is not registered yet', async () => {
      mockSerialsRepo.isRegistered.mockResolvedValue(false);

      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-12345',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      const result = await useCase.execute(input);

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

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-12345',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      const result = await useCase.execute(input);

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

    it('should throw an error if registration fails', async () => {
      mockSerialsRepo.isRegistered.mockResolvedValue(false);
      mockSerializedInventoryService.register.mockRejectedValue(new Error('Registration failed'));

      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-12345',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Registration failed');
    });

    it('should throw an error if receive fails', async () => {
      mockSerialsRepo.isRegistered.mockResolvedValue(true);
      mockSerializedInventoryService.receive.mockRejectedValue(new Error('Receive failed'));

      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-12345',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Receive failed');
    });
  });

  describe('GetSerializedItemBySerialUseCase', () => {
    it('should return the serialized item when found', async () => {
      const mockItem = { serialNumber: new SerialNumber('SN-999'), tenantId: new TenantId('tenant-1') } as any;
      mockSerialsRepo.findBySerial.mockResolvedValue(mockItem);

      const useCase = new GetSerializedItemBySerialUseCase(mockSerialsRepo);
      const result = await useCase.execute('SN-999', 'tenant-1');

      expect(mockSerialsRepo.findBySerial).toHaveBeenCalledWith(
        new SerialNumber('SN-999'),
        new TenantId('tenant-1')
      );
      expect(result).toBe(mockItem);
    });

    it('should return null when the serialized item is not found', async () => {
      mockSerialsRepo.findBySerial.mockResolvedValue(null);

      const useCase = new GetSerializedItemBySerialUseCase(mockSerialsRepo);
      const result = await useCase.execute('SN-UNKNOWN', 'tenant-1');

      expect(mockSerialsRepo.findBySerial).toHaveBeenCalledWith(
        new SerialNumber('SN-UNKNOWN'),
        new TenantId('tenant-1')
      );
      expect(result).toBeNull();
    });

    it('should throw an error if repository findBySerial fails', async () => {
      mockSerialsRepo.findBySerial.mockRejectedValue(new Error('Repository error'));

      const useCase = new GetSerializedItemBySerialUseCase(mockSerialsRepo);
      await expect(useCase.execute('SN-UNKNOWN', 'tenant-1')).rejects.toThrow('Repository error');
    });
  });
});
