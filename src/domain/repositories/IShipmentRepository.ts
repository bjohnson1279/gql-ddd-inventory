import { Shipment } from '../shipping/aggregates/Shipment';

export interface IShipmentRepository {
  save(shipment: Shipment): Promise<void>;
  findById(id: string): Promise<Shipment | null>;
  findAll(): Promise<Shipment[]>;
}
