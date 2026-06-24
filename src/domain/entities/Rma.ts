import { RMAStatus, RMADisposition } from '../enums/ReturnEnums';
import { RmaItem } from './RmaItem';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';

export class Rma {
  private _status: RMAStatus;
  private readonly _items: RmaItem[];

  constructor(
    public readonly id: string,
    public readonly rmaNumber: string,
    public readonly tenantId: TenantId,
    public readonly customerId: string,
    public readonly locationId: LocationId,
    status: RMAStatus = RMAStatus.Requested,
    items: RmaItem[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this._status = status;
    this._items = [...items];
  }

  get status(): RMAStatus {
    return this._status;
  }

  get items(): ReadonlyArray<RmaItem> {
    return this._items;
  }

  authorize(): void {
    if (this._status !== RMAStatus.Requested) {
      throw new Error('Only requested RMAs can be authorized.');
    }
    this._status = RMAStatus.Authorized;
  }

  receiveItem(variantId: string, quantity: number, disposition: RMADisposition): void {
    if (
      this._status !== RMAStatus.Authorized &&
      this._status !== RMAStatus.Received
    ) {
      throw new Error('Can only receive items on Authorized or partially Received RMAs.');
    }

    const item = this._items.find((i) => i.variantId.value === variantId);
    if (!item) {
      throw new Error(`Item ${variantId} not found in this RMA.`);
    }

    item.receive(quantity, disposition);

    const allProcessed = this._items.every((i) => i.isFullyProcessed());
    if (allProcessed) {
      this._status = RMAStatus.Completed;
    } else {
      this._status = RMAStatus.Received;
    }
  }

  reject(): void {
    if (this._status !== RMAStatus.Requested && this._status !== RMAStatus.Authorized) {
      throw new Error('Cannot reject RMA after receipt has started.');
    }
    this._status = RMAStatus.Rejected;
  }
}
