import { IShipmentRepository } from '../../domain/repositories/IShipmentRepository';
import { Shipment } from '../../domain/shipping/aggregates/Shipment';
import { ShipmentStatus } from '../../domain/shipping/enums/ShipmentStatus';

export class InMemoryShipmentRepository implements IShipmentRepository {
  private readonly shipments: Map<string, Shipment> = new Map();

  private cloneShipment(shipment: Shipment): Shipment {
    return new Shipment(
      shipment.id,
      shipment.sku,
      shipment.quantity,
      shipment.destinationAddress,
      shipment.carrier,
      shipment.trackingNumber,
      shipment.labelUrl,
      shipment.shippingRateCents,
      shipment.status,
      shipment.createdAt,
      shipment.updatedAt
    );
  }

  async save(shipment: Shipment): Promise<void> {
    this.shipments.set(shipment.id, this.cloneShipment(shipment));
  }

  async findById(id: string): Promise<Shipment | null> {
    const found = this.shipments.get(id);
    if (!found) return null;
    return this.cloneShipment(found);
  }

  async findAll(): Promise<Shipment[]> {
    return Array.from(this.shipments.values()).map((s) => this.cloneShipment(s));
  }
}
