import { PrismaClient } from '@prisma/client';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { InventoryCostLayer, InventoryCostLayerId } from '../../domain/entities/InventoryCostLayer';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';

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
      },
      update: {
        consumedQuantity: layer.consumedQuantity,
      },
    });
  }

  async saveBatch(layers: InventoryCostLayer[]): Promise<void> {
    if (layers.length === 0) return;

    await this.prisma.$transaction(
      layers.map((layer) =>
        this.prisma.inventoryCostLayer.upsert({
          where: { id: layer.id.value },
          create: {
            id: layer.id.value,
            variantId: layer.variantId.value,
            initialQuantity: layer.initialQuantity,
            consumedQuantity: layer.consumedQuantity,
            unitCostCents: layer.unitCostCents,
            receivedAt: layer.receivedAt,
            serialNumber: layer.serialNumber?.value || null,
          },
          update: {
            consumedQuantity: layer.consumedQuantity,
          },
        })
      )
    );
  }

  async getActiveLayers(
    variantId: ProductVariantId,
    orderBy: string = 'asc'
  ): Promise<InventoryCostLayer[]> {
    const orderDirection = orderBy.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const dbLayers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        variantId: variantId.value,
      },
      orderBy: {
        receivedAt: orderDirection,
      },
    });

    return dbLayers
      .filter((l) => l.consumedQuantity < l.initialQuantity)
      .map((l) => {
        const layer = new InventoryCostLayer(
          new InventoryCostLayerId(l.id),
          new ProductVariantId(l.variantId),
          l.initialQuantity,
          l.unitCostCents,
          l.receivedAt,
          l.serialNumber ? new SerialNumber(l.serialNumber) : undefined
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

    const orderDirection = orderBy.toLowerCase() === 'desc' ? 'desc' : 'asc';
    const variantIdStrs = variantIds.map(v => v.value);

    const dbLayers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        variantId: { in: variantIdStrs },
        consumedQuantity: {
          lt: this.prisma.inventoryCostLayer.fields.initialQuantity
        }
      },
      orderBy: {
        receivedAt: orderDirection,
      },
    });

    const activeLayers = dbLayers.map((l) => {
      const layer = new InventoryCostLayer(
        new InventoryCostLayerId(l.id),
        new ProductVariantId(l.variantId),
        l.initialQuantity,
        l.unitCostCents,
        l.receivedAt,
        l.serialNumber ? new SerialNumber(l.serialNumber) : undefined
      );
      (layer as any)._consumedQuantity = l.consumedQuantity;
      return layer;
    });

    const map = new Map<string, InventoryCostLayer[]>();
    for (const v of variantIdStrs) {
      map.set(v, []);
    }
    for (const layer of activeLayers) {
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

    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(l.id),
      new ProductVariantId(l.variantId),
      l.initialQuantity,
      l.unitCostCents,
      l.receivedAt,
      l.serialNumber ? new SerialNumber(l.serialNumber) : undefined
    );
    (layer as any)._consumedQuantity = l.consumedQuantity;
    return layer;
  }
}
