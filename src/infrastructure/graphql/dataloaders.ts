import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

export interface DataLoaders {
  productVariants: DataLoader<string, any[]>;
  kitComponents: DataLoader<string, any[]>;
  costLayers: DataLoader<string, any[]>;
  externalMappings: DataLoader<string, any[]>;
}

export function createDataLoaders(prisma: PrismaClient): DataLoaders {
  return {
    productVariants: new DataLoader<string, any[]>(async (productIds) => {
      const variants = await prisma.productVariant.findMany({
        where: { productId: { in: productIds as string[] } },
        include: { attributes: true },
      });

      return productIds.map((id) =>
        variants
          .filter((v) => v.productId === id)
          .map((v) => ({
            id: v.id,
            sku: v.sku,
            trackingMode: v.trackingMode,
            attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
          }))
      );
    }),

    kitComponents: new DataLoader<string, any[]>(async (kitIds) => {
      const components = await prisma.kitComponent.findMany({
        where: { kitId: { in: kitIds as string[] } },
      });

      return kitIds.map((id) =>
        components
          .filter((c) => c.kitId === id)
          .map((c) => ({
            variantId: c.variantId,
            quantity: c.quantity,
          }))
      );
    }),

    costLayers: new DataLoader<string, any[]>(async (variantIds) => {
      // Find cost layers that are not fully consumed
      const layers = await prisma.inventoryCostLayer.findMany({
        where: {
          variantId: { in: variantIds as string[] },
          consumedQuantity: { lt: prisma.inventoryCostLayer.fields.initialQuantity },
        },
        orderBy: { receivedAt: 'asc' },
      });

      return variantIds.map((id) =>
        layers
          .filter((l) => l.variantId === id)
          .map((l) => ({
            id: l.id,
            variantId: l.variantId,
            initialQuantity: l.initialQuantity,
            consumedQuantity: l.consumedQuantity,
            unitCostCents: l.unitCostCents,
            receivedAt: l.receivedAt.toISOString(),
            serialNumber: l.serialNumber,
          }))
      );
    }),

    externalMappings: new DataLoader<string, any[]>(async (internalIds) => {
      const mappings = await prisma.externalMapping.findMany({
        where: { internalId: { in: internalIds as string[] } },
      });

      return internalIds.map((id) =>
        mappings
          .filter((m) => m.internalId === id)
          .map((m) => ({
            id: m.id,
            tenantId: m.tenantId,
            integrationId: m.integrationId,
            entityType: m.entityType,
            internalId: m.internalId,
            externalId: m.externalId,
            externalSecondaryId: m.externalSecondaryId,
          }))
      );
    }),
  };
}
