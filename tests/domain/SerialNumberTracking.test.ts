import { SerializedInventoryService } from '../../src/domain/services/SerializedInventoryService';
import { InMemorySerializedItemRepository } from '../../src/infrastructure/persistence/InMemorySerializedItemRepository';
import { InMemoryLedgerRepository } from '../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { SerialNumber } from '../../src/domain/valueObjects/SerialNumber';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { SerializedItemStatus } from '../../src/domain/enums/SerializedItemStatus';

describe('Serial Number Tracking', () => {
  let serialService: SerializedInventoryService;
  let serialRepo: InMemorySerializedItemRepository;
  let ledgerRepo: InMemoryLedgerRepository;

  const tenantId = new TenantId('T1');
  const locationId = new LocationId('L1');
  const actorId = new ActorId('U1');
  const variantId = new ProductVariantId('V1');

  beforeEach(() => {
    serialRepo = new InMemorySerializedItemRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    serialService = new SerializedInventoryService(serialRepo, ledgerRepo);
  });

  it('should follow the lifecycle: Register -> Receive -> Sell', async () => {
    const sn = new SerialNumber('SN123');

    // 1. Register
    await serialService.register(sn, variantId, tenantId, locationId, actorId);
    const item = await serialRepo.findBySerial(sn, tenantId);
    expect(item?.status).toBe(SerializedItemStatus.Pending);
    expect(await ledgerRepo.currentQuantity(variantId, locationId)).toBe(0);

    // 2. Receive
    await serialService.receive(sn, tenantId, locationId, 'PO1', 1000, actorId);
    expect(item?.status).toBe(SerializedItemStatus.InStock);
    expect(await ledgerRepo.currentQuantity(variantId, locationId)).toBe(1);

    // 3. Sell
    await serialService.sell(sn, tenantId, 'S1', actorId);
    expect(item?.status).toBe(SerializedItemStatus.Sold);
    expect(await ledgerRepo.currentQuantity(variantId, locationId)).toBe(0);
  });

  it('should prevent duplicate registration', async () => {
    const sn = new SerialNumber('SN123');
    await serialService.register(sn, variantId, tenantId, locationId, actorId);
    
    await expect(serialService.register(sn, variantId, tenantId, locationId, actorId))
      .rejects.toThrow('is already registered');
  });

  it('should prevent invalid transitions', async () => {
    const sn = new SerialNumber('SN123');
    await serialService.register(sn, variantId, tenantId, locationId, actorId);
    
    // Cannot sell a Pending item
    await expect(serialService.sell(sn, tenantId, 'S1', actorId))
      .rejects.toThrow('Invalid status transition');
  });

  it('should correctly report availability and track history', async () => {
    const sn = new SerialNumber('SN-HISTORY');
    await serialService.register(sn, variantId, tenantId, locationId, actorId);
    const item = (await serialRepo.findBySerial(sn, tenantId))!;

    expect(item.isAvailable).toBe(false);
    
    await serialService.receive(sn, tenantId, locationId, 'PO1', 1000, actorId);
    expect(item.isAvailable).toBe(true);
    expect(item.locationId.equals(locationId)).toBe(true);

    expect(item.history).toHaveLength(1);
    expect(item.history[0].to).toBe(SerializedItemStatus.InStock);
    
    await serialService.sell(sn, tenantId, 'S1', actorId);
    expect(item.isAvailable).toBe(false);
    expect(item.history).toHaveLength(2);
  });

  it('should throw error if serial number not found for receive/sell', async () => {
    const sn = new SerialNumber('MISSING');
    await expect(serialService.receive(sn, tenantId, locationId, 'PO1', 1000, actorId)).rejects.toThrow('not found');
    await expect(serialService.sell(sn, tenantId, 'S1', actorId)).rejects.toThrow('not found');
  });
});
