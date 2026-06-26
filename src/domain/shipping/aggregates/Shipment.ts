import { ShipmentStatus } from '../enums/ShipmentStatus';

export class Shipment {
  constructor(
    public readonly id: string,
    public readonly sku: string,
    public readonly quantity: number,
    public readonly destinationAddress: string,
    public readonly carrier: string,
    public trackingNumber: string | null,
    public labelUrl: string | null,
    public readonly shippingRateCents: number,
    private _status: ShipmentStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  public get status(): ShipmentStatus {
    return this._status;
  }

  public updateStatus(newStatus: ShipmentStatus): void {
    // Basic state machine validation
    if (this._status === ShipmentStatus.DELIVERED || this._status === ShipmentStatus.FAILED) {
      throw new Error(`Cannot transition status from terminal state: ${this._status}`);
    }
    
    this._status = newStatus;
  }
}
