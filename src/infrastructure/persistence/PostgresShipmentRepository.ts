import { PrismaClient } from '@prisma/client';
import { IShipmentRepository } from '../../domain/repositories/IShipmentRepository';
import { Shipment } from '../../domain/shipping/aggregates/Shipment';
import { ShipmentStatus } from '../../domain/shipping/enums/ShipmentStatus';
import crypto from 'node:crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresShipmentRepository implements IShipmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(shipment: Shipment): Promise<void> {
    const dbId = toUuid(shipment.id);

    await this.prisma.shipment.upsert({
      where: { id: dbId },
      create: {
        id: dbId,
        sku: shipment.sku,
        quantity: shipment.quantity,
        destinationAddress: shipment.destinationAddress,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        labelUrl: shipment.labelUrl,
        shippingRateCents: shipment.shippingRateCents,
        status: shipment.status,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      },
      update: {
        trackingNumber: shipment.trackingNumber,
        labelUrl: shipment.labelUrl,
        status: shipment.status,
        updatedAt: new Date(),
      },
    });
  }

  async findById(id: string): Promise<Shipment | null> {
    const dbId = toUuid(id);
    const result = await this.prisma.shipment.findUnique({
      where: { id: dbId },
    });

    if (!result) return null;

    return new Shipment(
      result.id,
      result.sku,
      result.quantity,
      result.destinationAddress,
      result.carrier,
      result.trackingNumber,
      result.labelUrl,
      result.shippingRateCents,
      result.status as ShipmentStatus,
      result.createdAt,
      result.updatedAt
    );
  }

  async findAll(): Promise<Shipment[]> {
    const results = await this.prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return results.map(
      (result) =>
        new Shipment(
          result.id,
          result.sku,
          result.quantity,
          result.destinationAddress,
          result.carrier,
          result.trackingNumber,
          result.labelUrl,
          result.shippingRateCents,
          result.status as ShipmentStatus,
          result.createdAt,
          result.updatedAt
        )
    );
  }
}
