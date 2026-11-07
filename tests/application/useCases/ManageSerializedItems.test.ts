import {
  GetSerializedItemBySerialUseCase,
  ReceiveSerializedItemUseCase,
  SellSerializedItemUseCase,
  ReturnSerializedItemUseCase,
  RestockSerializedItemUseCase,
  WriteOffSerializedItemUseCase,
  ListSerializedItemsByVariantUseCase,
  CountSerializedItemsByStatusUseCase,
} from '../../../src/application/useCases/ManageSerializedItems';
import { SerializedInventoryService } from '../../../src/domain/services/SerializedInventoryService';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import { SerializedItemId } from '../../../src/domain/valueObjects/SerializedItemId';
import { SerializedItem } from '../../../src/domain/entities/SerializedItem';
import { SerializedItemStatus } from '../../../src/domain/enums/SerializedItemStatus';

describe('ManageSerializedItems', () => {
  let mockSerializedInventoryService: jest.Mocked<SerializedInventoryService>;
  let mockSerialsRepo: jest.Mocked<ISerializedItemRepository>;
  let mockCostLayerRepo: jest.Mocked<IInventoryCostLayerRepository>;
  let mockJournalRepo: jest.Mocked<IJournalRepository>;

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
      findByVariantId: jest.fn(),
      countAllStatuses: jest.fn(),
    } as any;

    mockCostLayerRepo = {
      save: jest.fn(),
      saveBatch: jest.fn(),
      getActiveLayers: jest.fn(),
      getActiveLayersBatch: jest.fn(),
      findBySerial: jest.fn(),
    } as any;

    mockJournalRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByReference: jest.fn(),
      entriesForAccount: jest.fn(),
      allEntries: jest.fn(),
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


    it('should throw an error for invalid serial number (empty)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: '',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Serial number cannot be empty.');
    });

    it('should throw an error for invalid serial number (too long)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'A'.repeat(101),
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Serial number cannot exceed 100 characters.');
    });

    it('should throw an error for invalid serial number (invalid characters)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN!@#',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Serial number contains invalid characters: SN!@#');
    });

    it('should propagate errors from serializedInventoryService.register', async () => {
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

    it('should propagate errors from serializedInventoryService.receive', async () => {
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


    it('should throw an error for invalid tenantId (empty)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-1234',
        tenantId: '',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('TenantId cannot be empty.');
    });

    it('should throw an error for invalid locationId (empty)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-1234',
        tenantId: 'tenant-1',
        locationId: '',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('LocationId cannot be empty.');
    });


    it('should throw an error for invalid actorId (empty)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: 'variant-1',
        serialNumber: 'SN-1234',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: '',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('ActorId cannot be empty.');
    });

    it('should throw an error for invalid variantId (empty)', async () => {
      const useCase = new ReceiveSerializedItemUseCase(
        mockSerializedInventoryService,
        mockSerialsRepo
      );

      const input = {
        variantId: '',
        serialNumber: 'SN-1234',
        tenantId: 'tenant-1',
        locationId: 'location-1',
        actorId: 'actor-1',
        purchaseOrderId: 'PO-987',
        unitCostCents: 1500,
      };

      await expect(useCase.execute(input)).rejects.toThrow('ProductVariantId cannot be empty.');
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

  describe('SellSerializedItemUseCase', () => {
    it('should delegate sell to SerializedInventoryService and return true', async () => {
      mockSerializedInventoryService.sell.mockResolvedValue();

      const useCase = new SellSerializedItemUseCase(mockSerializedInventoryService);
      const result = await useCase.execute({
        serialNumber: 'SN-100',
        tenantId: 'tenant-1',
        saleId: 'SALE-123',
        actorId: 'actor-1',
      });

      expect(result).toBe(true);
      expect(mockSerializedInventoryService.sell).toHaveBeenCalledWith(
        new SerialNumber('SN-100'),
        new TenantId('tenant-1'),
        'SALE-123',
        new ActorId('actor-1')
      );
    });

    it('should propagate errors from SerializedInventoryService.sell', async () => {
      mockSerializedInventoryService.sell.mockRejectedValue(new Error('Item not in stock'));

      const useCase = new SellSerializedItemUseCase(mockSerializedInventoryService);
      await expect(
        useCase.execute({
          serialNumber: 'SN-100',
          tenantId: 'tenant-1',
          saleId: 'SALE-123',
          actorId: 'actor-1',
        })
      ).rejects.toThrow('Item not in stock');
    });
  });

  describe('ReturnSerializedItemUseCase', () => {
    it('should transition item to Returned, save it to repository, and return true', async () => {
      const item = new SerializedItem(
        new SerializedItemId('item-1'),
        new ProductVariantId('var-1'),
        new SerialNumber('SN-100'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        SerializedItemStatus.Sold
      );
      mockSerialsRepo.findBySerial.mockResolvedValue(item);
      mockSerialsRepo.save.mockResolvedValue();

      const useCase = new ReturnSerializedItemUseCase(mockSerialsRepo);
      const result = await useCase.execute({
        serialNumber: 'SN-100',
        tenantId: 'tenant-1',
        referenceId: 'RET-001',
        actorId: 'actor-1',
      });

      expect(result).toBe(true);
      expect(item.status).toBe(SerializedItemStatus.Returned);
      expect(mockSerialsRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw an error when serialized item is not found', async () => {
      mockSerialsRepo.findBySerial.mockResolvedValue(null);

      const useCase = new ReturnSerializedItemUseCase(mockSerialsRepo);
      await expect(
        useCase.execute({
          serialNumber: 'SN-NONEXISTENT',
          tenantId: 'tenant-1',
          referenceId: 'RET-001',
          actorId: 'actor-1',
        })
      ).rejects.toThrow('Serial number SN-NONEXISTENT not found for tenant tenant-1.');
    });
  });

  describe('RestockSerializedItemUseCase', () => {
    it('should transition item to InStock, save it to repository, and return true', async () => {
      const item = new SerializedItem(
        new SerializedItemId('item-1'),
        new ProductVariantId('var-1'),
        new SerialNumber('SN-100'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        SerializedItemStatus.Returned
      );
      mockSerialsRepo.findBySerial.mockResolvedValue(item);
      mockSerialsRepo.save.mockResolvedValue();

      const useCase = new RestockSerializedItemUseCase(mockSerialsRepo);
      const result = await useCase.execute({
        serialNumber: 'SN-100',
        tenantId: 'tenant-1',
        locationId: 'loc-2',
        referenceId: 'RESTOCK-001',
        actorId: 'actor-1',
      });

      expect(result).toBe(true);
      expect(item.status).toBe(SerializedItemStatus.InStock);
      expect(mockSerialsRepo.save).toHaveBeenCalledWith(item);
    });

    it('should throw an error when serialized item is not found', async () => {
      mockSerialsRepo.findBySerial.mockResolvedValue(null);

      const useCase = new RestockSerializedItemUseCase(mockSerialsRepo);
      await expect(
        useCase.execute({
          serialNumber: 'SN-NONEXISTENT',
          tenantId: 'tenant-1',
          locationId: 'loc-1',
          referenceId: 'RESTOCK-001',
          actorId: 'actor-1',
        })
      ).rejects.toThrow('Serial number SN-NONEXISTENT not found for tenant tenant-1.');
    });
  });

  describe('WriteOffSerializedItemUseCase', () => {
    it('should transition item to WrittenOff, consume cost layers, post journal entry, and return true', async () => {
      const item = new SerializedItem(
        new SerializedItemId('item-1'),
        new ProductVariantId('var-1'),
        new SerialNumber('SN-100'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        SerializedItemStatus.InStock
      );
      mockSerialsRepo.findBySerial.mockResolvedValue(item);
      mockSerialsRepo.save.mockResolvedValue();
      const mockLayer = {
        id: { value: 'layer-1' },
        variantId: new ProductVariantId('var-1'),
        lotBatchId: null,
        serialNumber: new SerialNumber('SN-100'),
        unitCostCents: 2500,
        remainingQuantity: 1,
        consume: jest.fn().mockReturnValue(1),
      } as any;
      mockCostLayerRepo.findBySerial.mockResolvedValue(mockLayer);
      mockCostLayerRepo.getActiveLayers.mockResolvedValue([mockLayer]);
      mockJournalRepo.save.mockResolvedValue();

      const useCase = new WriteOffSerializedItemUseCase(
        mockSerialsRepo,
        mockCostLayerRepo,
        mockJournalRepo
      );

      const result = await useCase.execute({
        serialNumber: 'SN-100',
        variantId: 'var-1',
        tenantId: 'tenant-1',
        reason: 'Damaged beyond repair',
        actorId: 'actor-1',
      });

      expect(result).toBe(true);
      expect(item.status).toBe(SerializedItemStatus.WrittenOff);
      expect(mockSerialsRepo.save).toHaveBeenCalledWith(item);
      expect(mockJournalRepo.save).toHaveBeenCalled();
    });

    it('should throw an error when serialized item is not found for write-off', async () => {
      mockSerialsRepo.findBySerial.mockResolvedValue(null);

      const useCase = new WriteOffSerializedItemUseCase(
        mockSerialsRepo,
        mockCostLayerRepo,
        mockJournalRepo
      );

      await expect(
        useCase.execute({
          serialNumber: 'SN-UNKNOWN',
          variantId: 'var-1',
          tenantId: 'tenant-1',
          reason: 'Damaged',
          actorId: 'actor-1',
        })
      ).rejects.toThrow('Serial number SN-UNKNOWN not found for tenant tenant-1.');
    });
  });

  describe('ListSerializedItemsByVariantUseCase', () => {
    it('should query repository by variant and tenant, returning list of items', async () => {
      const items = [
        new SerializedItem(
          new SerializedItemId('item-1'),
          new ProductVariantId('var-1'),
          new SerialNumber('SN-100'),
          new TenantId('tenant-1'),
          new LocationId('loc-1'),
          SerializedItemStatus.InStock
        ),
      ];
      mockSerialsRepo.findByVariantId.mockResolvedValue(items);

      const useCase = new ListSerializedItemsByVariantUseCase(mockSerialsRepo);
      const result = await useCase.execute('var-1', 'tenant-1');

      expect(result).toEqual(items);
      expect(mockSerialsRepo.findByVariantId).toHaveBeenCalledWith(
        new ProductVariantId('var-1'),
        new TenantId('tenant-1')
      );
    });

    it('should return empty array when no items exist for variant', async () => {
      mockSerialsRepo.findByVariantId.mockResolvedValue([]);

      const useCase = new ListSerializedItemsByVariantUseCase(mockSerialsRepo);
      const result = await useCase.execute('var-empty', 'tenant-1');

      expect(result).toEqual([]);
      expect(mockSerialsRepo.findByVariantId).toHaveBeenCalledWith(
        new ProductVariantId('var-empty'),
        new TenantId('tenant-1')
      );
    });
  });

  describe('CountSerializedItemsByStatusUseCase', () => {
    it('should delegate status counting to repository', async () => {
      const mockCounts = {
        [SerializedItemStatus.Pending]: 2,
        [SerializedItemStatus.InStock]: 10,
        [SerializedItemStatus.Sold]: 5,
        [SerializedItemStatus.Returned]: 0,
        [SerializedItemStatus.Quarantined]: 0,
        [SerializedItemStatus.Transferred]: 0,
        [SerializedItemStatus.Damaged]: 0,
        [SerializedItemStatus.WrittenOff]: 1,
      } as Record<SerializedItemStatus, number>;
      mockSerialsRepo.countAllStatuses.mockResolvedValue(mockCounts);

      const useCase = new CountSerializedItemsByStatusUseCase(mockSerialsRepo);
      const result = await useCase.execute('var-1');

      expect(result).toEqual(mockCounts);
      expect(mockSerialsRepo.countAllStatuses).toHaveBeenCalledWith(new ProductVariantId('var-1'));
    });
  });
});
