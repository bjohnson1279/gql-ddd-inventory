import { LotBatch } from '../../../src/domain/entities/LotBatch';
import { LotBatchId } from '../../../src/domain/valueObjects/LotBatchId';

describe('LotBatch Entity', () => {
  it('should instantiate successfully with a string id and convert to LotBatchId', () => {
    const lot = new LotBatch('lot-123', 'tenant-1', 'LOT-001', 'VAR-001');
    expect(lot.id).toBeInstanceOf(LotBatchId);
    expect(lot.id.value).toBe('lot-123');
    expect(lot.tenantId).toBe('tenant-1');
    expect(lot.lotNumber).toBe('LOT-001');
    expect(lot.variantId).toBe('VAR-001');
    expect(lot.status).toBe('ACTIVE');
    expect(lot.createdAt).toBeInstanceOf(Date);
  });

  it('should instantiate successfully with a LotBatchId value object', () => {
    const lotId = new LotBatchId('lot-456');
    const lot = new LotBatch(lotId, 'tenant-1', 'LOT-002', 'VAR-002');
    expect(lot.id).toBe(lotId);
    expect(lot.id.value).toBe('lot-456');
  });

  it('should throw an error on instantiation when id is empty or invalid string', () => {
    expect(() => new LotBatch('', 'tenant-1', 'LOT-001', 'VAR-001')).toThrow('LotBatchId cannot be empty.');
  });

  it('should accurately report availability based on status and expiration date', () => {
    const lot = new LotBatch('lot-1', 'tenant-1', 'LOT-001', 'VAR-001', 'ACTIVE');
    expect(lot.isAvailable()).toBe(true);

    const futureDate = new Date(Date.now() + 1000000);
    const validLot = new LotBatch('lot-2', 'tenant-1', 'LOT-002', 'VAR-001', 'ACTIVE', undefined, futureDate);
    expect(validLot.isAvailable()).toBe(true);

    const pastDate = new Date(Date.now() - 1000000);
    const expiredLot = new LotBatch('lot-3', 'tenant-1', 'LOT-003', 'VAR-001', 'ACTIVE', undefined, pastDate);
    expect(expiredLot.isAvailable()).toBe(false);
  });

  it('should handle quarantine, recall, and release lifecycle transitions', () => {
    const lot = new LotBatch('lot-1', 'tenant-1', 'LOT-001', 'VAR-001');

    lot.quarantine('Inspection required');
    expect(lot.status).toBe('QUARANTINED');
    expect(lot.quarantineReason).toBe('Inspection required');
    expect(lot.quarantinedAt).toBeInstanceOf(Date);
    expect(lot.isAvailable()).toBe(false);

    lot.release();
    expect(lot.status).toBe('ACTIVE');
    expect(lot.quarantineReason).toBeUndefined();
    expect(lot.quarantinedAt).toBeUndefined();
    expect(lot.recalledAt).toBeUndefined();
    expect(lot.isAvailable()).toBe(true);

    lot.recall('Severe defect');
    expect(lot.status).toBe('RECALLED');
    expect(lot.quarantineReason).toBe('Severe defect');
    expect(lot.recalledAt).toBeInstanceOf(Date);
    expect(lot.isAvailable()).toBe(false);
  });
});
