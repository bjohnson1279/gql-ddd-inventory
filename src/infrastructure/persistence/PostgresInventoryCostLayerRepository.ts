import { PrismaClient, Prisma } from '@prisma/client';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { InventoryCostLayer, InventoryCostLayerId } from '../../domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';
import { Lot } from '../../domain/valueObjects/Lot';

export class PostgresInventoryCostLayerRepository implements IInventoryCostLayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(layer: InventoryCostLayer): Promise<void> {
    await this.prisma.inventoryCostLayer.upsert({
      where: { id: layer.id.value },
      create: {
        id: layer.id.value,
        variantId: layer.variantId.value,
        initialQuantity: layer.initialQuantity,
        consumedQuantity: layer.consumedQuantity,
        unitCostCents: layer.unitCostCents,
        receivedAt: layer.receivedAt,
        serialNumber: layer.serialNumber?.value || null,
        lotNumber: layer.lot?.lotNumber || null,
        expirationDate: layer.lot?.expirationDate || null,
      },
      update: {
        consumedQuantity: layer.consumedQuantity,
      },
    });
  }

  async saveBatch(layers: InventoryCostLayer[]): Promise<void> {
    if (layers.length === 0) return;

    // ⚡ Bolt: Replaced Promise.all and individual upserts with a raw SQL batch upsert to eliminate N+1 queries
    const insertRows = layers.map((layer) => {
      return Prisma.sql`(${layer.id.value}::uuid, ${layer.variantId.value}::uuid, ${layer.initialQuantity}::int, ${layer.consumedQuantity}::int, ${layer.unitCostCents}::int, ${layer.receivedAt}::timestamptz, ${layer.serialNumber?.value || null}, ${layer.lot?.lotNumber || null}, ${layer.lot?.expirationDate || null}::timestamptz)`;
    });

    await this.prisma.$executeRaw`
      INSERT INTO inventory_cost_layers (id, variant_id, initial_quantity, consumed_quantity, unit_cost_cents, received_at, serial_number, lot_number, expiration_date)
      VALUES ${Prisma.join(insertRows)}
      ON CONFLICT (id) DO UPDATE SET
        consumed_quantity = EXCLUDED.consumed_quantity;
    `;
  }

  async getActiveLayers(
    variantId: ProductVariantId,
    orderBy: string = 'asc'
  ): Promise<InventoryCostLayer[]> {
    const isExpiration = orderBy.toLowerCase().includes('expiration');
    const orderDirection = orderBy.toLowerCase().includes('desc') ? 'desc' : 'asc';

    const dbLayers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        variantId: variantId.value,
        consumedQuantity: {
          lt: this.prisma.inventoryCostLayer.fields.initialQuantity
        }
      },
      orderBy: isExpiration
        ? [
            { expirationDate: orderDirection },
            { receivedAt: 'asc' }
          ]
        : {
            receivedAt: orderDirection,
          },
    });

    return dbLayers
      .map((l) => {
        const lot = l.lotNumber && l.expirationDate
          ? new Lot(l.lotNumber, l.expirationDate)
          : undefined;
        const layer = new InventoryCostLayer(
          new InventoryCostLayerId(l.id),
          new ProductVariantId(l.variantId),
          l.initialQuantity,
          l.unitCostCents,
          l.receivedAt,
          l.serialNumber ? new SerialNumber(l.serialNumber) : undefined,
          lot
        );
        (layer as any)._consumedQuantity = l.consumedQuantity;
        return layer;
      });
  }

  async getActiveLayersBatch(
    variantIds: ProductVariantId[],
    orderBy: string = 'asc'
  ): Promise<Map<string, InventoryCostLayer[]>> {
    if (variantIds.length === 0) return new Map();

    const isExpiration = orderBy.toLowerCase().includes('expiration');
    const orderDirection = orderBy.toLowerCase().includes('desc') ? 'desc' : 'asc';
    const variantIdStrs = variantIds.map(v => v.value);

    const dbLayers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        variantId: { in: variantIdStrs },
        consumedQuantity: {
          lt: this.prisma.inventoryCostLayer.fields.initialQuantity
        }
      },
      orderBy: isExpiration
        ? [
            { expirationDate: orderDirection },
            { receivedAt: 'asc' }
          ]
        : {
            receivedAt: orderDirection,
          },
    });

    // ⚡ Bolt: Consolidated .map() and grouping into a single loop to avoid intermediate array allocation
    const map = new Map<string, InventoryCostLayer[]>();
    for (const v of variantIdStrs) {
      map.set(v, []);
    }

    for (const l of dbLayers) {
      const lot = l.lotNumber && l.expirationDate
        ? new Lot(l.lotNumber, l.expirationDate)
        : undefined;
      const layer = new InventoryCostLayer(
        new InventoryCostLayerId(l.id),
        new ProductVariantId(l.variantId),
        l.initialQuantity,
        l.unitCostCents,
        l.receivedAt,
        l.serialNumber ? new SerialNumber(l.serialNumber) : undefined,
        lot
      );
      (layer as any)._consumedQuantity = l.consumedQuantity;

      const arr = map.get(layer.variantId.value);
      if (arr) {
        arr.push(layer);
      }
    }

    return map;
  }

  async findBySerial(
    variantId: ProductVariantId,
    serialNumber: SerialNumber
  ): Promise<InventoryCostLayer | null> {
    const l = await this.prisma.inventoryCostLayer.findFirst({
      where: {
        variantId: variantId.value,
        serialNumber: serialNumber.value,
      },
    });

    if (!l) return null;

    const lot = l.lotNumber && l.expirationDate
      ? new Lot(l.lotNumber, l.expirationDate)
      : undefined;
    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(l.id),
      new ProductVariantId(l.variantId),
      l.initialQuantity,
      l.unitCostCents,
      l.receivedAt,
      l.serialNumber ? new SerialNumber(l.serialNumber) : undefined,
      lot
    );
    (layer as any)._consumedQuantity = l.consumedQuantity;
    return layer;
  }
}
