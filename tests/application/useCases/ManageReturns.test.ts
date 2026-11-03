import {
  CreateRmaUseCase,
  ReceiveRmaUseCase,
  AuthorizeRmaUseCase,
  ResolveQuarantineItemUseCase
} from '../../../src/application/useCases/ManageReturns';
import { IRmaRepository } from '../../../src/domain/repositories/IRmaRepository';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { IQuarantineRepository } from '../../../src/domain/repositories/IQuarantineRepository';
import { IJournalRepository } from '../../../src/domain/repositories/IJournalRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ISerializedItemRepository } from '../../../src/domain/repositories/ISerializedItemRepository';
import { Rma } from '../../../src/domain/entities/Rma';
import { RmaItem } from '../../../src/domain/entities/RmaItem';
import { QuarantineItem } from '../../../src/domain/entities/QuarantineItem';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { SerializedItem } from '../../../src/domain/entities/SerializedItem';
import { SerializedItemId } from '../../../src/domain/valueObjects/SerializedItemId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { RMAStatus, RMADisposition, QuarantineStatus } from '../../../src/domain/enums/ReturnEnums';
import { SerializedItemStatus } from '../../../src/domain/enums/SerializedItemStatus';

describe('ManageReturns Use Cases', () => {
  describe('CreateRmaUseCase', () => {
    let mockRmaRepo: jest.Mocked<IRmaRepository>;

    beforeEach(() => {
      mockRmaRepo = {
        save: jest.fn(),
        findById: jest.fn(),
        findByNumber: jest.fn(),
        findAllByTenant: jest.fn()
      } as unknown as jest.Mocked<IRmaRepository>;
    });

    it('should throw an error if RMA number already exists', async () => {
      mockRmaRepo.findByNumber.mockResolvedValue({ id: 'existing-id' } as any);
      const useCase = new CreateRmaUseCase(mockRmaRepo);

      await expect(
        useCase.execute({
          rmaNumber: 'RMA-001',
          tenantId: 'tenant-1',
          customerId: 'cust-1',
          locationId: 'loc-1',
          items: [{ variantId: 'var-1', quantity: 2, unitCostCents: 500 }]
        })
      ).rejects.toThrow('RMA with number RMA-001 already exists.');
    });

    it('should create and save a new RMA successfully', async () => {
      mockRmaRepo.findByNumber.mockResolvedValue(null);
      mockRmaRepo.save.mockResolvedValue();
      const useCase = new CreateRmaUseCase(mockRmaRepo);

      const result = await useCase.execute({
        rmaNumber: 'RMA-100',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        locationId: 'loc-1',
        items: [
          { variantId: 'var-1', quantity: 2, unitCostCents: 500 },
          { variantId: 'var-2', quantity: 1, unitCostCents: 1200 }
        ]
      });

      expect(result).toBeInstanceOf(Rma);
      expect(result.rmaNumber).toBe('RMA-100');
      expect(result.tenantId.value).toBe('tenant-1');
      expect(result.customerId).toBe('cust-1');
      expect(result.locationId.value).toBe('loc-1');
      expect(result.status).toBe(RMAStatus.Requested);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].variantId.value).toBe('var-1');
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].unitCostCents).toBe(500);
      expect(mockRmaRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRmaRepo.save).toHaveBeenCalledWith(result);
    });
  });

  describe('AuthorizeRmaUseCase', () => {
    let mockRmaRepo: jest.Mocked<IRmaRepository>;

    beforeEach(() => {
      mockRmaRepo = {
        save: jest.fn(),
        findById: jest.fn(),
        findByNumber: jest.fn(),
        findAllByTenant: jest.fn()
      } as unknown as jest.Mocked<IRmaRepository>;
    });

    it('should throw an error if RMA is not found', async () => {
      mockRmaRepo.findById.mockResolvedValue(null);
      const useCase = new AuthorizeRmaUseCase(mockRmaRepo);

      await expect(useCase.execute('invalid-id')).rejects.toThrow(
        'RMA with ID invalid-id not found.'
      );
    });

    it('should authorize a requested RMA successfully', async () => {
      const rma = new Rma(
        'rma-1',
        'RMA-001',
        new TenantId('tenant-1'),
        'cust-1',
        new LocationId('loc-1'),
        RMAStatus.Requested,
        [new RmaItem('item-1', new ProductVariantId('var-1'), 2, 500)]
      );
      mockRmaRepo.findById.mockResolvedValue(rma);
      mockRmaRepo.save.mockResolvedValue();

      const useCase = new AuthorizeRmaUseCase(mockRmaRepo);
      await useCase.execute('rma-1');

      expect(rma.status).toBe(RMAStatus.Authorized);
      expect(mockRmaRepo.save).toHaveBeenCalledWith(rma);
    });

    it('should throw an error when authorizing an already completed or rejected RMA', async () => {
      const rma = new Rma(
        'rma-1',
        'RMA-001',
        new TenantId('tenant-1'),
        'cust-1',
        new LocationId('loc-1'),
        RMAStatus.Completed,
        []
      );
      mockRmaRepo.findById.mockResolvedValue(rma);

      const useCase = new AuthorizeRmaUseCase(mockRmaRepo);
      await expect(useCase.execute('rma-1')).rejects.toThrow(
        'Only requested RMAs can be authorized.'
      );
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
        save: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn(),
        findByNumber: jest.fn(),
        findAllByTenant: jest.fn()
      } as unknown as jest.Mocked<IRmaRepository>;

      mockInventoryRepo = {
        findBySkuAndLocation: jest.fn(),
        findBySkuAndLocationBatch: jest.fn().mockResolvedValue([]),
        saveBatch: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<IInventoryRepository>;

      mockCostLayerRepo = {
        save: jest.fn().mockResolvedValue(undefined),
        saveBatch: jest.fn().mockResolvedValue(undefined),
        getActiveLayers: jest.fn().mockResolvedValue([]),
        getActiveLayersBatch: jest.fn().mockResolvedValue(new Map()),
        findBySerial: jest.fn()
      } as unknown as jest.Mocked<IInventoryCostLayerRepository>;

      mockQuarantineRepo = {
        saveBatch: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn()
      } as unknown as jest.Mocked<IQuarantineRepository>;

      mockJournalRepo = {
        saveBatch: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<IJournalRepository>;

      mockProductRepo = {
        findSkusByVariantIds: jest.fn(),
        findSkuByVariantId: jest.fn()
      } as unknown as jest.Mocked<IProductRepository>;

      mockSerializedItemRepo = {
        saveBatch: jest.fn().mockResolvedValue(undefined),
        findBySerialsAndVariantsBatch: jest.fn().mockResolvedValue([]),
        findBySerial: jest.fn()
      } as unknown as jest.Mocked<ISerializedItemRepository>;
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

    it('should throw an error if SKU is not found for variant ID', async () => {
      mockRmaRepo.findById.mockResolvedValue({
        locationId: { value: 'LOC-1' }
      } as any);

      mockProductRepo.findSkusByVariantIds.mockResolvedValue(new Map());

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
        rmaId: 'valid-rma-id',
        items: [{ variantId: 'invalid-variant', quantityReceived: 1, disposition: RMADisposition.Restock }]
      };

      await expect(useCase.execute(dto)).rejects.toThrow('SKU not found for variant ID invalid-variant');
    });

    it('should throw an error if item is not found in RMA', async () => {
      mockRmaRepo.findById.mockResolvedValue({
        locationId: { value: 'LOC-1' },
        items: []
      } as any);

      const skuMap = new Map<string, string>();
      skuMap.set('missing-variant', 'SKU-123');
      mockProductRepo.findSkusByVariantIds.mockResolvedValue(skuMap);
      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([]);

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
        rmaId: 'valid-rma-id',
        items: [{ variantId: 'missing-variant', quantityReceived: 1, disposition: RMADisposition.Restock }]
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'Item with variant ID missing-variant not found in RMA.'
      );
    });

    it('should receive items with RESTOCK disposition creating stock and cost layers', async () => {
      const rmaItem = new RmaItem('item-1', new ProductVariantId('var-1'), 5, 200);
      const rma = new Rma(
        'rma-1',
        'RMA-100',
        new TenantId('tenant-1'),
        'cust-1',
        new LocationId('loc-main'),
        RMAStatus.Authorized,
        [rmaItem]
      );
      mockRmaRepo.findById.mockResolvedValue(rma);

      const skuMap = new Map<string, string>();
      skuMap.set('var-1', 'SKU-A');
      mockProductRepo.findSkusByVariantIds.mockResolvedValue(skuMap);

      const existingInv = InventoryItem.createNew('inv-1', 'SKU-A', 'loc-main');
      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([existingInv]);

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepo
      );

      await useCase.execute({
        rmaId: 'rma-1',
        items: [{ variantId: 'var-1', quantityReceived: 5, disposition: RMADisposition.Restock }]
      });

      expect(rma.status).toBe(RMAStatus.Completed);
      expect(existingInv.quantity.value).toBe(5);
      expect(mockInventoryRepo.saveBatch).toHaveBeenCalledWith([existingInv]);
      expect(mockCostLayerRepo.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            variantId: expect.objectContaining({ value: 'var-1' }),
            initialQuantity: 5,
            unitCostCents: 200
          })
        ])
      );
      expect(mockJournalRepo.saveBatch).toHaveBeenCalledTimes(1);
      expect(mockQuarantineRepo.saveBatch).not.toHaveBeenCalled();
      expect(mockRmaRepo.save).toHaveBeenCalledWith(rma);
    });

    it('should receive items with QUARANTINE disposition to quarantine location', async () => {
      const rmaItem = new RmaItem('item-1', new ProductVariantId('var-1'), 2, 350);
      const rma = new Rma(
        'rma-1',
        'RMA-200',
        new TenantId('tenant-1'),
        'cust-1',
        new LocationId('loc-wh'),
        RMAStatus.Authorized,
        [rmaItem]
      );
      mockRmaRepo.findById.mockResolvedValue(rma);

      const skuMap = new Map<string, string>();
      skuMap.set('var-1', 'SKU-Q');
      mockProductRepo.findSkusByVariantIds.mockResolvedValue(skuMap);

      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([]);

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepo,
        mockSerializedItemRepo
      );

      await useCase.execute({
        rmaId: 'rma-1',
        items: [{ variantId: 'var-1', quantityReceived: 2, disposition: RMADisposition.Quarantine }]
      });

      expect(rma.status).toBe(RMAStatus.Completed);
      expect(mockQuarantineRepo.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            variantId: expect.objectContaining({ value: 'var-1' }),
            quantity: 2,
            reason: 'Returned from RMA RMA-200'
          })
        ])
      );
      expect(mockInventoryRepo.saveBatch).toHaveBeenCalledTimes(1);
      expect(mockCostLayerRepo.saveBatch).toHaveBeenCalledTimes(1);
    });

    it('should receive items with SCRAP disposition and consume cost layers', async () => {
      const rmaItem = new RmaItem('item-1', new ProductVariantId('var-1'), 3, 500);
      const rma = new Rma(
        'rma-1',
        'RMA-300',
        new TenantId('tenant-1'),
        'cust-1',
        new LocationId('loc-wh'),
        RMAStatus.Authorized,
        [rmaItem]
      );
      mockRmaRepo.findById.mockResolvedValue(rma);

      const skuMap = new Map<string, string>();
      skuMap.set('var-1', 'SKU-SCRAP');
      mockProductRepo.findSkusByVariantIds.mockResolvedValue(skuMap);

      const existingInv = InventoryItem.createNew('inv-1', 'SKU-SCRAP', 'loc-wh');
      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([existingInv]);

      const costLayer = new InventoryCostLayer(
        new InventoryCostLayerId('layer-1'),
        new ProductVariantId('var-1'),
        10,
        500,
        new Date()
      );
      const batchMap = new Map<string, InventoryCostLayer[]>();
      batchMap.set('var-1', [costLayer]);
      mockCostLayerRepo.getActiveLayersBatch.mockResolvedValue(batchMap);

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepo,
        mockSerializedItemRepo
      );

      await useCase.execute({
        rmaId: 'rma-1',
        items: [{ variantId: 'var-1', quantityReceived: 3, disposition: RMADisposition.Scrap }]
      });

      expect(rma.status).toBe(RMAStatus.Completed);
      expect(existingInv.quantity.value).toBe(0); // received 3, then dispatched 3
      expect(mockCostLayerRepo.saveBatch).toHaveBeenCalled();
      // Should save 2 journal entries: stock returned + inventory write off
      expect(mockJournalRepo.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ description: expect.stringContaining('return receipt') }),
          expect.objectContaining({ description: expect.stringContaining('Write-Off') })
        ])
      );
    });

    it('should transition serialized items correctly based on disposition', async () => {
      const rmaItem1 = new RmaItem('item-1', new ProductVariantId('var-1'), 1, 100);
      const rmaItem2 = new RmaItem('item-2', new ProductVariantId('var-2'), 1, 200);
      const rmaItem3 = new RmaItem('item-3', new ProductVariantId('var-3'), 1, 300);
      const rma = new Rma(
        'rma-1',
        'RMA-400',
        new TenantId('tenant-1'),
        'cust-1',
        new LocationId('loc-1'),
        RMAStatus.Authorized,
        [rmaItem1, rmaItem2, rmaItem3]
      );
      mockRmaRepo.findById.mockResolvedValue(rma);

      const skuMap = new Map<string, string>();
      skuMap.set('var-1', 'SKU-1');
      skuMap.set('var-2', 'SKU-2');
      skuMap.set('var-3', 'SKU-3');
      mockProductRepo.findSkusByVariantIds.mockResolvedValue(skuMap);

      const ser1 = new SerializedItem(
        new SerializedItemId('s1'),
        new ProductVariantId('var-1'),
        new SerialNumber('SN-01'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        SerializedItemStatus.Sold
      );
      const ser2 = new SerializedItem(
        new SerializedItemId('s2'),
        new ProductVariantId('var-2'),
        new SerialNumber('SN-02'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        SerializedItemStatus.Sold
      );
      const ser3 = new SerializedItem(
        new SerializedItemId('s3'),
        new ProductVariantId('var-3'),
        new SerialNumber('SN-03'),
        new TenantId('tenant-1'),
        new LocationId('loc-1'),
        SerializedItemStatus.Sold
      );

      mockSerializedItemRepo.findBySerialsAndVariantsBatch.mockResolvedValue([ser1, ser2, ser3]);

      const costLayer = new InventoryCostLayer(
        new InventoryCostLayerId('l-3'),
        new ProductVariantId('var-3'),
        5,
        300,
        new Date()
      );
      const batchMap = new Map<string, InventoryCostLayer[]>();
      batchMap.set('var-3', [costLayer]);
      mockCostLayerRepo.getActiveLayersBatch.mockResolvedValue(batchMap);

      const useCase = new ReceiveRmaUseCase(
        mockRmaRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockQuarantineRepo,
        mockJournalRepo,
        mockProductRepo,
        mockSerializedItemRepo
      );

      await useCase.execute({
        rmaId: 'rma-1',
        items: [
          { variantId: 'var-1', quantityReceived: 1, disposition: RMADisposition.Restock, serialNumbers: ['SN-01'] },
          { variantId: 'var-2', quantityReceived: 1, disposition: RMADisposition.Quarantine, serialNumbers: ['SN-02'] },
          { variantId: 'var-3', quantityReceived: 1, disposition: RMADisposition.Scrap, serialNumbers: ['SN-03'] }
        ]
      });

      expect(ser1.status).toBe(SerializedItemStatus.InStock);
      expect(ser2.status).toBe(SerializedItemStatus.Quarantined);
      expect(ser3.status).toBe(SerializedItemStatus.WrittenOff);
      expect(mockSerializedItemRepo.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([ser1, ser2, ser3])
      );
    });
  });

  describe('ResolveQuarantineItemUseCase', () => {
    let mockQuarantineRepo: jest.Mocked<IQuarantineRepository>;
    let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
    let mockCostLayerRepo: jest.Mocked<IInventoryCostLayerRepository>;
    let mockJournalRepo: jest.Mocked<IJournalRepository>;
    let mockProductRepo: jest.Mocked<IProductRepository>;

    beforeEach(() => {
      mockQuarantineRepo = {
        findById: jest.fn(),
        saveBatch: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<IQuarantineRepository>;

      mockInventoryRepo = {
        findBySkuAndLocation: jest.fn(),
        findBySkuAndLocationBatch: jest.fn().mockResolvedValue([]),
        saveBatch: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<IInventoryRepository>;

      mockCostLayerRepo = {
        save: jest.fn().mockResolvedValue(undefined),
        saveBatch: jest.fn().mockResolvedValue(undefined),
        getActiveLayers: jest.fn().mockResolvedValue([]),
        getActiveLayersBatch: jest.fn().mockResolvedValue(new Map()),
        findBySerial: jest.fn()
      } as unknown as jest.Mocked<IInventoryCostLayerRepository>;

      mockJournalRepo = {
        saveBatch: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<IJournalRepository>;

      mockProductRepo = {
        findSkusByVariantIds: jest.fn(),
        findSkuByVariantId: jest.fn()
      } as unknown as jest.Mocked<IProductRepository>;
    });

    it('should throw an error if quarantine item is not found', async () => {
      mockQuarantineRepo.findById.mockResolvedValue(null);

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      const dto = { quarantineItemId: 'invalid-id', resolution: 'RESTOCK' as const };
      await expect(useCase.execute(dto)).rejects.toThrow(
        'Quarantine item with ID invalid-id not found.'
      );
    });

    it('should throw an error if SKU is not found for variant', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        5,
        'Damaged box',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue(null);

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      const dto = { quarantineItemId: 'q-1', resolution: 'RESTOCK' as const };
      await expect(useCase.execute(dto)).rejects.toThrow('SKU not found for variant ID var-1');
    });

    it('should throw an error if quarantine stock is not found', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        5,
        'Damaged box',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue('SKU-1');
      mockInventoryRepo.findBySkuAndLocation.mockResolvedValue(null);

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      const dto = { quarantineItemId: 'q-1', resolution: 'RESTOCK' as const };
      await expect(useCase.execute(dto)).rejects.toThrow(
        'Quarantine stock not found for variant var-1 at loc-1-quarantine.'
      );
    });

    it('should resolve quarantine item as RESTOCK successfully', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        3,
        'Inspection passed',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue('SKU-1');

      const invQuarantine = InventoryItem.createNew('inv-q', 'SKU-1', 'loc-1-quarantine');
      invQuarantine.receiveStock(new Quantity(10));

      const invSellable = InventoryItem.createNew('inv-sell', 'SKU-1', 'loc-1');

      mockInventoryRepo.findBySkuAndLocation.mockImplementation(async (sku, loc) => {
        if (loc === 'loc-1-quarantine') return invQuarantine;
        if (loc === 'loc-1') return invSellable;
        return null;
      });

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      await useCase.execute({ quarantineItemId: 'q-1', resolution: 'RESTOCK' });

      expect(qItem.status).toBe(QuarantineStatus.Restocked);
      expect(invQuarantine.quantity.value).toBe(7);
      expect(invSellable.quantity.value).toBe(3);
      expect(mockInventoryRepo.saveBatch).toHaveBeenCalled();
      expect(mockQuarantineRepo.save).toHaveBeenCalledWith(qItem);
    });

    it('should resolve quarantine item as RESTOCK creating new inventory item if sellable does not exist', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        2,
        'Inspection passed',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue('SKU-1');

      const invQuarantine = InventoryItem.createNew('inv-q', 'SKU-1', 'loc-1-quarantine');
      invQuarantine.receiveStock(new Quantity(5));

      mockInventoryRepo.findBySkuAndLocation.mockImplementation(async (sku, loc) => {
        if (loc === 'loc-1-quarantine') return invQuarantine;
        return null;
      });

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      await useCase.execute({ quarantineItemId: 'q-1', resolution: 'RESTOCK' });

      expect(qItem.status).toBe(QuarantineStatus.Restocked);
      expect(invQuarantine.quantity.value).toBe(3);
      expect(mockInventoryRepo.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          invQuarantine,
          expect.objectContaining({ sku: expect.objectContaining({ value: 'SKU-1' }) })
        ])
      );
    });

    it('should resolve quarantine item as SCRAP and trigger approval workflow if intercepted', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        4,
        'Broken beyond repair',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue('SKU-1');

      const costLayer = new InventoryCostLayer(
        new InventoryCostLayerId('l-1'),
        new ProductVariantId('var-1'),
        10,
        1500,
        new Date()
      );
      mockCostLayerRepo.getActiveLayers.mockResolvedValue([costLayer]);

      const mockApprovalService = {
        evaluateAndIntercept: jest.fn().mockResolvedValue({
          intercepted: true,
          requestId: 'req-999'
        })
      };

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo,
        mockApprovalService
      );

      await expect(
        useCase.execute({ quarantineItemId: 'q-1', resolution: 'SCRAP' }, 't-1', 'user-1')
      ).rejects.toThrow('RequiresApproval:req-999');

      expect(mockApprovalService.evaluateAndIntercept).toHaveBeenCalledWith(
        't-1',
        'inventory.write_off',
        'QuarantineItem',
        'q-1',
        'user-1',
        { totalCostCents: 6000, resolution: 'SCRAP', quantity: 4 }
      );
      expect(mockQuarantineRepo.save).not.toHaveBeenCalled();
    });

    it('should resolve quarantine item as SCRAP without interception when approval passes', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        2,
        'Damaged',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue('SKU-1');

      const invQuarantine = InventoryItem.createNew('inv-q', 'SKU-1', 'loc-1-quarantine');
      invQuarantine.receiveStock(new Quantity(5));
      mockInventoryRepo.findBySkuAndLocation.mockResolvedValue(invQuarantine);

      const costLayer = new InventoryCostLayer(
        new InventoryCostLayerId('l-1'),
        new ProductVariantId('var-1'),
        10,
        1000,
        new Date()
      );
      mockCostLayerRepo.getActiveLayers.mockResolvedValue([costLayer]);

      const mockApprovalService = {
        evaluateAndIntercept: jest.fn().mockResolvedValue({
          intercepted: false
        })
      };

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo,
        mockApprovalService
      );

      await useCase.execute({ quarantineItemId: 'q-1', resolution: 'SCRAP' }, 't-1', 'user-1');

      expect(qItem.status).toBe(QuarantineStatus.Scrapped);
      expect(invQuarantine.quantity.value).toBe(3);
      expect(mockCostLayerRepo.saveBatch).toHaveBeenCalled();
      expect(mockJournalRepo.save).toHaveBeenCalled();
      expect(mockQuarantineRepo.save).toHaveBeenCalledWith(qItem);
    });

    it('should resolve quarantine item as RTV (Return To Vendor)', async () => {
      const qItem = new QuarantineItem(
        'q-1',
        new ProductVariantId('var-1'),
        2,
        'Defective from vendor',
        new LocationId('loc-1'),
        new TenantId('t-1')
      );
      mockQuarantineRepo.findById.mockResolvedValue(qItem);
      mockProductRepo.findSkuByVariantId.mockResolvedValue('SKU-1');

      const invQuarantine = InventoryItem.createNew('inv-q', 'SKU-1', 'loc-1-quarantine');
      invQuarantine.receiveStock(new Quantity(5));
      mockInventoryRepo.findBySkuAndLocation.mockResolvedValue(invQuarantine);

      const costLayer = new InventoryCostLayer(
        new InventoryCostLayerId('l-1'),
        new ProductVariantId('var-1'),
        10,
        800,
        new Date()
      );
      mockCostLayerRepo.getActiveLayers.mockResolvedValue([costLayer]);

      const useCase = new ResolveQuarantineItemUseCase(
        mockQuarantineRepo,
        mockInventoryRepo,
        mockCostLayerRepo,
        mockJournalRepo,
        mockProductRepo
      );

      await useCase.execute({ quarantineItemId: 'q-1', resolution: 'RTV' });

      expect(qItem.status).toBe(QuarantineStatus.Rtv);
      expect(invQuarantine.quantity.value).toBe(3);
      expect(mockCostLayerRepo.saveBatch).toHaveBeenCalled();
      expect(mockJournalRepo.save).toHaveBeenCalled();
      expect(mockQuarantineRepo.save).toHaveBeenCalledWith(qItem);
    });
  });
});
