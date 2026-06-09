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

      const variantsByProductId = new Map<string, any[]>();
      for (const v of variants) {
        if (!variantsByProductId.has(v.productId)) {
          variantsByProductId.set(v.productId, []);
        }
        variantsByProductId.get(v.productId)!.push({
          id: v.id,
          sku: v.sku,
          trackingMode: v.trackingMode,
          costingMethod: v.costingMethod,
          attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
        });
      }

      return productIds.map((id) => variantsByProductId.get(id) || []);
    }),

    kitComponents: new DataLoader<string, any[]>(async (kitIds) => {
      const components = await prisma.kitComponent.findMany({
        where: { kitId: { in: kitIds as string[] } },
      });

      const componentsByKitId = new Map<string, any[]>();
      for (const c of components) {
        if (!componentsByKitId.has(c.kitId)) {
          componentsByKitId.set(c.kitId, []);
        }
        componentsByKitId.get(c.kitId)!.push({
          variantId: c.variantId,
          quantity: c.quantity,
        });
      }

      return kitIds.map((id) => componentsByKitId.get(id) || []);
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

      const layersByVariantId = new Map<string, any[]>();
      for (const l of layers) {
        if (!layersByVariantId.has(l.variantId)) {
          layersByVariantId.set(l.variantId, []);
        }
        layersByVariantId.get(l.variantId)!.push({
          id: l.id,
          variantId: l.variantId,
          initialQuantity: l.initialQuantity,
          consumedQuantity: l.consumedQuantity,
          unitCostCents: l.unitCostCents,
          receivedAt: l.receivedAt.toISOString(),
          serialNumber: l.serialNumber,
          lot: l.lotNumber ? {
            lotNumber: l.lotNumber,
            expirationDate: l.expirationDate ? l.expirationDate.toISOString() : '',
          } : null,
        });
      }

      return variantIds.map((id) => layersByVariantId.get(id) || []);
    }),

    externalMappings: new DataLoader<string, any[]>(async (internalIds) => {
      const mappings = await prisma.externalMapping.findMany({
        where: { internalId: { in: internalIds as string[] } },
      });

      const mappingsByInternalId = new Map<string, any[]>();
      for (const m of mappings) {
        if (!mappingsByInternalId.has(m.internalId)) {
          mappingsByInternalId.set(m.internalId, []);
        }
        mappingsByInternalId.get(m.internalId)!.push({
          id: m.id,
          tenantId: m.tenantId,
          integrationId: m.integrationId,
          entityType: m.entityType,
          internalId: m.internalId,
          externalId: m.externalId,
          externalSecondaryId: m.externalSecondaryId,
        });
      }

      return internalIds.map((id) => mappingsByInternalId.get(id) || []);
    }),
  };
}
