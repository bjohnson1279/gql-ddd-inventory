import { QuarantineStatus } from '../enums/ReturnEnums';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { LocationId } from '../valueObjects/LocationId';
import { TenantId } from '../valueObjects/TenantId';

export class QuarantineItem {
  private _status: QuarantineStatus;
  private _resolvedAt: Date | null;

  constructor(
    public readonly id: string,
    public readonly variantId: ProductVariantId,
    public readonly quantity: number,
    public readonly reason: string,
    public readonly locationId: LocationId,
    public readonly tenantId: TenantId,
    status: QuarantineStatus = QuarantineStatus.Quarantined,
    public readonly createdAt: Date = new Date(),
    resolvedAt: Date | null = null
  ) {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }
    this._status = status;
    this._resolvedAt = resolvedAt;
  }

  get status(): QuarantineStatus {
    return this._status;
  }

  get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  resolveRestock(): void {
    if (this._status !== QuarantineStatus.Quarantined) {
      throw new Error('Quarantine item is already resolved.');
    }
    this._status = QuarantineStatus.Restocked;
    this._resolvedAt = new Date();
  }

  resolveScrap(): void {
    if (this._status !== QuarantineStatus.Quarantined) {
      throw new Error('Quarantine item is already resolved.');
    }
    this._status = QuarantineStatus.Scrapped;
    this._resolvedAt = new Date();
  }

  resolveRtv(): void {
    if (this._status !== QuarantineStatus.Quarantined) {
      throw new Error('Quarantine item is already resolved.');
    }
    this._status = QuarantineStatus.Rtv;
    this._resolvedAt = new Date();
  }
}
