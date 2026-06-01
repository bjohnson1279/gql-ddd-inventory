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

  async saveMany(layers: InventoryCostLayer[]): Promise<void> {
    if (layers.length === 0) return;
    const queries = layers.map(layer =>
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
    );
    await this.prisma.$transaction(queries);
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

    const dbLayers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        variantId: { in: variantIds.map(v => v.value) },
      },
      orderBy: {
        receivedAt: orderDirection,
      },
    });

    const activeLayersMap = new Map<string, InventoryCostLayer[]>();

    for (const l of dbLayers) {
      if (l.consumedQuantity >= l.initialQuantity) continue;

      const layer = new InventoryCostLayer(
        new InventoryCostLayerId(l.id),
        new ProductVariantId(l.variantId),
        l.initialQuantity,
        l.unitCostCents,
        l.receivedAt,
        l.serialNumber ? new SerialNumber(l.serialNumber) : undefined
      );
      (layer as any)._consumedQuantity = l.consumedQuantity;

      const existing = activeLayersMap.get(l.variantId) || [];
      existing.push(layer);
      activeLayersMap.set(l.variantId, existing);
    }

    return activeLayersMap;
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
