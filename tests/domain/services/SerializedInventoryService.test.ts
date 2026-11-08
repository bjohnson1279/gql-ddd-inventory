import { SerializedInventoryService } from '../../../src/domain/services/SerializedInventoryService';
import { InMemorySerializedItemRepository } from '../../../src/infrastructure/persistence/InMemorySerializedItemRepository';
import { InMemoryLedgerRepository } from '../../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import { SerializedItemStatus } from '../../../src/domain/enums/SerializedItemStatus';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';
import { DomainEvent } from '../../../src/domain/events/DomainEvent';

describe('SerializedInventoryService', () => {
  let serialsRepository: InMemorySerializedItemRepository;
  let ledgerRepository: InMemoryLedgerRepository;
  let eventDispatcher: jest.Mock<void, [DomainEvent]>;
  let service: SerializedInventoryService;

  const tenantId = new TenantId('tenant-1');
  const locationId = new LocationId('loc-1');
  const restockLocationId = new LocationId('loc-2');
  const actorId = new ActorId('actor-1');
  const variantId = new ProductVariantId('var-1');
  const serialNumber1 = new SerialNumber('SN001');
  const serialNumber2 = new SerialNumber('SN002');

  beforeEach(() => {
    serialsRepository = new InMemorySerializedItemRepository();
    ledgerRepository = new InMemoryLedgerRepository();
    eventDispatcher = jest.fn();
    service = new SerializedInventoryService(serialsRepository, ledgerRepository, eventDispatcher);
  });

  describe('constructor', () => {
    it('should default eventDispatcher parameter gracefully without error', async () => {
      const defaultService = new SerializedInventoryService(serialsRepository, ledgerRepository);
      await defaultService.register(serialNumber1, variantId, tenantId, locationId, actorId);
      await expect(
        defaultService.receive(serialNumber1, tenantId, locationId, 'PO-1', 100, actorId)
      ).resolves.not.toThrow();
    });
  });

  describe('register', () => {
    it('should successfully register a new serial number', async () => {
      const item = await service.register(serialNumber1, variantId, tenantId, locationId, actorId);

      expect(item).toBeDefined();
      expect(item.serialNumber.value).toBe(serialNumber1.value);
      expect(item.status).toBe(SerializedItemStatus.Pending);

      const isRegistered = await serialsRepository.isRegistered(serialNumber1, tenantId);
      expect(isRegistered).toBe(true);
    });

    it('should throw an error when attempting to register an already registered serial number', async () => {
      await service.register(serialNumber1, variantId, tenantId, locationId, actorId);

      await expect(
        service.register(serialNumber1, variantId, tenantId, locationId, actorId)
      ).rejects.toThrow(`Serial number ${serialNumber1.value} is already registered.`);
    });
  });

  describe('receive', () => {
    const purchaseOrderId = 'PO-123';
    const unitCostCents = 1500;

    beforeEach(async () => {
      await service.register(serialNumber1, variantId, tenantId, locationId, actorId);
    });

    it('should successfully receive a registered serial number', async () => {
      await service.receive(serialNumber1, tenantId, locationId, purchaseOrderId, unitCostCents, actorId);

      const item = await serialsRepository.findBySerial(serialNumber1, tenantId);
      expect(item).not.toBeNull();
      expect(item?.status).toBe(SerializedItemStatus.InStock);

      const ledgerEntries = await ledgerRepository.entriesFor(variantId, locationId);
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].quantity).toBe(1);
      expect(ledgerEntries[0].reason).toBe(ReasonCode.PurchaseReceipt);
      expect(ledgerEntries[0].referenceId).toBe(purchaseOrderId);
      expect(ledgerEntries[0].metadata?.serialNumber).toBe(serialNumber1.value);
      expect(ledgerEntries[0].metadata?.unitCostCents).toBe(unitCostCents);

      expect(eventDispatcher).toHaveBeenCalled();
    });

    it('should throw an error when attempting to receive a non-existent serial number', async () => {
      await expect(
        service.receive(serialNumber2, tenantId, locationId, purchaseOrderId, unitCostCents, actorId)
      ).rejects.toThrow(`Serial number ${serialNumber2.value} not found.`);
    });
  });

  describe('sell', () => {
    const saleId = 'SALE-456';
    const purchaseOrderId = 'PO-123';
    const unitCostCents = 1500;

    beforeEach(async () => {
      await service.register(serialNumber1, variantId, tenantId, locationId, actorId);
    });

    it('should successfully sell an in-stock serial number', async () => {
      // Must receive it first to be InStock
      await service.receive(serialNumber1, tenantId, locationId, purchaseOrderId, unitCostCents, actorId);
      eventDispatcher.mockClear();

      await service.sell(serialNumber1, tenantId, saleId, actorId);

      const item = await serialsRepository.findBySerial(serialNumber1, tenantId);
      expect(item).not.toBeNull();
      expect(item?.status).toBe(SerializedItemStatus.Sold);

      const ledgerEntries = await ledgerRepository.entriesFor(variantId, locationId);
      // Expected 2: 1 from receive, 1 from sell
      expect(ledgerEntries).toHaveLength(2);
      const sellEntry = ledgerEntries.find(e => e.quantity === -1);
      expect(sellEntry).toBeDefined();
      expect(sellEntry?.reason).toBe(ReasonCode.Sale);
      expect(sellEntry?.referenceId).toBe(saleId);
      expect(sellEntry?.metadata?.serialNumber).toBe(serialNumber1.value);

      expect(eventDispatcher).toHaveBeenCalled();
    });

    it('should throw an error when attempting to sell a non-existent serial number', async () => {
      await expect(
        service.sell(serialNumber2, tenantId, saleId, actorId)
      ).rejects.toThrow(`Serial number ${serialNumber2.value} not found.`);
    });

    it('should throw an error when attempting to sell a serial number that is not in stock', async () => {
      // It is only registered, status is Pending
      await expect(
        service.sell(serialNumber1, tenantId, saleId, actorId)
      ).rejects.toThrow();
    });
  });

  describe('return', () => {
    const returnRefId = 'RET-789';
    const saleId = 'SALE-456';
    const purchaseOrderId = 'PO-123';
    const unitCostCents = 1500;

    beforeEach(async () => {
      await service.register(serialNumber1, variantId, tenantId, locationId, actorId);
    });

    it('should successfully return a sold serial number, create ledger entry, and dispatch events', async () => {
      await service.receive(serialNumber1, tenantId, locationId, purchaseOrderId, unitCostCents, actorId);
      await service.sell(serialNumber1, tenantId, saleId, actorId);
      eventDispatcher.mockClear();

      await service.return(serialNumber1, tenantId, returnRefId, actorId);

      const item = await serialsRepository.findBySerial(serialNumber1, tenantId);
      expect(item).not.toBeNull();
      expect(item?.status).toBe(SerializedItemStatus.Returned);

      const ledgerEntries = await ledgerRepository.entriesFor(variantId, locationId);
      expect(ledgerEntries).toHaveLength(3);

      const returnEntry = ledgerEntries.find(e => e.referenceId === returnRefId);
      expect(returnEntry).toBeDefined();
      expect(returnEntry?.quantity).toBe(1);
      expect(returnEntry?.reason).toBe(ReasonCode.Return);
      expect(returnEntry?.metadata?.serialNumber).toBe(serialNumber1.value);

      expect(eventDispatcher).toHaveBeenCalled();
    });

    it('should throw an error when attempting to return a non-existent serial number', async () => {
      await expect(
        service.return(serialNumber2, tenantId, returnRefId, actorId)
      ).rejects.toThrow(`Serial number ${serialNumber2.value} not found.`);
    });

    it('should throw an error when attempting to return an item that is not in Sold status', async () => {
      // Item is only registered (Pending status)
      await expect(
        service.return(serialNumber1, tenantId, returnRefId, actorId)
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('restock', () => {
    const restockRefId = 'RESTOCK-999';
    const returnRefId = 'RET-789';
    const saleId = 'SALE-456';
    const purchaseOrderId = 'PO-123';
    const unitCostCents = 1500;

    beforeEach(async () => {
      await service.register(serialNumber1, variantId, tenantId, locationId, actorId);
    });

    it('should successfully restock a returned serial number, update ledger, and dispatch events', async () => {
      await service.receive(serialNumber1, tenantId, locationId, purchaseOrderId, unitCostCents, actorId);
      await service.sell(serialNumber1, tenantId, saleId, actorId);
      await service.return(serialNumber1, tenantId, returnRefId, actorId);
      eventDispatcher.mockClear();

      await service.restock(serialNumber1, tenantId, restockLocationId, restockRefId, actorId);

      const item = await serialsRepository.findBySerial(serialNumber1, tenantId);
      expect(item).not.toBeNull();
      expect(item?.status).toBe(SerializedItemStatus.InStock);

      const restockLedgerEntries = await ledgerRepository.entriesFor(variantId, restockLocationId);
      expect(restockLedgerEntries).toHaveLength(1);
      const restockEntry = restockLedgerEntries[0];
      expect(restockEntry.quantity).toBe(1);
      expect(restockEntry.reason).toBe(ReasonCode.PurchaseReceipt);
      expect(restockEntry.referenceId).toBe(restockRefId);
      expect(restockEntry.locationId.equals(restockLocationId)).toBe(true);
      expect(restockEntry.metadata?.serialNumber).toBe(serialNumber1.value);

      expect(eventDispatcher).toHaveBeenCalled();
    });

    it('should throw an error when attempting to restock a non-existent serial number', async () => {
      await expect(
        service.restock(serialNumber2, tenantId, restockLocationId, restockRefId, actorId)
      ).rejects.toThrow(`Serial number ${serialNumber2.value} not found.`);
    });

    it('should throw an error when attempting to restock an item with invalid transition status', async () => {
      // Item is in Sold status, restock transition to InStock is invalid directly from Sold
      await service.receive(serialNumber1, tenantId, locationId, purchaseOrderId, unitCostCents, actorId);
      await service.sell(serialNumber1, tenantId, saleId, actorId);

      await expect(
        service.restock(serialNumber1, tenantId, restockLocationId, restockRefId, actorId)
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('event dispatch', () => {
    it('should explicitly dispatch domain events upon receive', async () => {
      await service.register(serialNumber1, variantId, tenantId, locationId, actorId);
      eventDispatcher.mockClear();
      await service.receive(serialNumber1, tenantId, locationId, 'PO-999', 1000, actorId);
      expect(eventDispatcher).toHaveBeenCalled();
    });
  });
});
