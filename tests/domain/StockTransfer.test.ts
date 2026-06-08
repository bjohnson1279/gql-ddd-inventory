import { StockTransfer } from '../../src/domain/entities/StockTransfer';
import { StockTransferId } from '../../src/domain/valueObjects/StockTransferId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { StockTransferItem } from '../../src/domain/valueObjects/StockTransferItem';
import { StockTransferStatus } from '../../src/domain/enums/StockTransferStatus';
import {
  StockTransferDispatched,
  StockTransferReceived,
  StockTransferCancelled
} from '../../src/domain/events/StockTransferEvents';

describe('StockTransfer Aggregate Root', () => {
  const id = new StockTransferId('transfer-1');
  const tenantId = new TenantId('T1');
  const sourceLoc = new LocationId('LOC-A');
  const destLoc = new LocationId('LOC-B');
  const items = [
    new StockTransferItem(new ProductVariantId('V1'), 10)
  ];

  it('should initialize correctly with status Draft', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items, 'REF-1');
    expect(transfer.status).toBe(StockTransferStatus.Draft);
    expect(transfer.sourceLocationId.value).toBe('LOC-A');
    expect(transfer.destinationLocationId.value).toBe('LOC-B');
    expect(transfer.items).toHaveLength(1);
    expect(transfer.referenceId).toBe('REF-1');
  });

  it('should throw error if source and destination locations are the same', () => {
    expect(() => {
      new StockTransfer(id, tenantId, sourceLoc, sourceLoc, items);
    }).toThrow('Source and destination locations cannot be the same.');
  });

  it('should throw error if items list is empty', () => {
    expect(() => {
      new StockTransfer(id, tenantId, sourceLoc, destLoc, []);
    }).toThrow('Stock transfer must contain at least one item.');
  });

  it('should transition status to Dispatched and record dispatchedAt', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    transfer.dispatch();

    expect(transfer.status).toBe(StockTransferStatus.Dispatched);
    expect(transfer.dispatchedAt).not.toBeNull();
    const events = transfer.pullDomainEvents();
    expect(events.some(e => e instanceof StockTransferDispatched)).toBe(true);
  });

  it('should throw error when dispatching a non-Draft transfer', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    transfer.dispatch();

    expect(() => transfer.dispatch()).toThrow('Cannot dispatch a stock transfer in status: dispatched');
  });

  it('should transition status to Received and record receivedAt', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    transfer.dispatch();
    transfer.receive();

    expect(transfer.status).toBe(StockTransferStatus.Received);
    expect(transfer.receivedAt).not.toBeNull();
    const events = transfer.pullDomainEvents();
    expect(events.some(e => e instanceof StockTransferReceived)).toBe(true);
  });

  it('should throw error when receiving a non-Dispatched transfer', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    expect(() => transfer.receive()).toThrow('Cannot receive a stock transfer in status: draft');
  });

  it('should transition status to Cancelled from Draft or Dispatched', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    transfer.cancel();
    expect(transfer.status).toBe(StockTransferStatus.Cancelled);

    const transfer2 = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    transfer2.dispatch();
    transfer2.cancel();
    expect(transfer2.status).toBe(StockTransferStatus.Cancelled);
  });

  it('should throw error when cancelling a Received transfer', () => {
    const transfer = StockTransfer.createNew(id, tenantId, sourceLoc, destLoc, items);
    transfer.dispatch();
    transfer.receive();

    expect(() => transfer.cancel()).toThrow('Cannot cancel a stock transfer in status: received');
  });
});
