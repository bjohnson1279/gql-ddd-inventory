import { PrismaClient } from '@prisma/client';
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

    const uniqueLayers = Array.from(new Map(layers.map((l) => [l.id.value, l])).values());
    const layerIds = uniqueLayers.map((l) => l.id.value);

    await this.prisma.$transaction(async (tx) => {
      // Fetch existing layer IDs to separate inserts from updates within the transaction
      const existingRecords = await tx.inventoryCostLayer.findMany({
        where: { id: { in: layerIds } },
        select: { id: true },
      });

      const existingIds = new Set(existingRecords.map((r) => r.id));

      const layersToCreate: any[] = [];
      const layersToUpdate: InventoryCostLayer[] = [];

      for (const layer of uniqueLayers) {
        if (existingIds.has(layer.id.value)) {
          layersToUpdate.push(layer);
        } else {
          layersToCreate.push({
            id: layer.id.value,
            variantId: layer.variantId.value,
            initialQuantity: layer.initialQuantity,
            consumedQuantity: layer.consumedQuantity,
            unitCostCents: layer.unitCostCents,
            receivedAt: layer.receivedAt,
            serialNumber: layer.serialNumber?.value || null,
            lotNumber: layer.lot?.lotNumber || null,
            expirationDate: layer.lot?.expirationDate || null,
          });
        }
      }

      if (layersToCreate.length > 0) {
        await tx.inventoryCostLayer.createMany({
          data: layersToCreate,
        });
      }

      if (layersToUpdate.length > 0) {
        // Prisma doesn't support bulk update with different values per row, so we map updates
        for (const layer of layersToUpdate) {
          await tx.inventoryCostLayer.update({
            where: { id: layer.id.value },
            data: { consumedQuantity: layer.consumedQuantity },
          });
        }
      }
    });
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

    const activeLayers = dbLayers.map((l) => {
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
