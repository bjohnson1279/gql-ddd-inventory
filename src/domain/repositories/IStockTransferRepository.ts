import { StockTransfer } from '../entities/StockTransfer';
import { StockTransferId } from '../valueObjects/StockTransferId';
import { TenantId } from '../valueObjects/TenantId';

export interface IStockTransferRepository {
  findById(id: StockTransferId): Promise<StockTransfer | null>;
  findAllByTenant(tenantId: TenantId): Promise<StockTransfer[]>;
  save(transfer: StockTransfer): Promise<void>;
  saveBatch(transfers: StockTransfer[]): Promise<void>;
}
