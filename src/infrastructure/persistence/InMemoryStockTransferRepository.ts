import { IStockTransferRepository } from '../../domain/repositories/IStockTransferRepository';
import { StockTransfer } from '../../domain/entities/StockTransfer';
import { StockTransferId } from '../../domain/valueObjects/StockTransferId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { StockTransferItem } from '../../domain/valueObjects/StockTransferItem';

export class InMemoryStockTransferRepository implements IStockTransferRepository {
  private readonly transfers: Map<string, StockTransfer> = new Map();

  private cloneTransfer(transfer: StockTransfer): StockTransfer {
    const items = transfer.items.map(i => new StockTransferItem(i.variantId, i.quantity));
    return StockTransfer.reconstruct(
      new StockTransferId(transfer.id.value),
      new TenantId(transfer.tenantId.value),
      new LocationId(transfer.sourceLocationId.value),
      new LocationId(transfer.destinationLocationId.value),
      items,
      transfer.status,
      transfer.referenceId,
      transfer.dispatchedAt,
      transfer.receivedAt,
      transfer.createdAt
    );
  }

  async findById(id: StockTransferId): Promise<StockTransfer | null> {
    const transfer = this.transfers.get(id.value);
    return transfer ? this.cloneTransfer(transfer) : null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<StockTransfer[]> {
    return Array.from(this.transfers.values())
      .filter(t => t.tenantId.value === tenantId.value)
      .map(t => this.cloneTransfer(t));
  }

  async save(transfer: StockTransfer): Promise<void> {
    this.transfers.set(transfer.id.value, transfer);
  }
}
