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

      const variantsByProduct = new Map<string, any[]>();
      for (const v of variants) {
        if (!variantsByProduct.has(v.productId)) {
          variantsByProduct.set(v.productId, []);
        }
        variantsByProduct.get(v.productId)!.push({
          id: v.id,
          sku: v.sku,
          trackingMode: v.trackingMode,
          costingMethod: v.costingMethod,
          attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
        });
      }

      return productIds.map((id) => variantsByProduct.get(id) || []);
    }),

    kitComponents: new DataLoader<string, any[]>(async (kitIds) => {
      const components = await prisma.kitComponent.findMany({
        where: { kitId: { in: kitIds as string[] } },
      });

      const componentsByKit = new Map<string, any[]>();
      for (const c of components) {
        if (!componentsByKit.has(c.kitId)) {
          componentsByKit.set(c.kitId, []);
        }
        componentsByKit.get(c.kitId)!.push({
          variantId: c.variantId,
          quantity: c.quantity,
        });
      }

      return kitIds.map((id) => componentsByKit.get(id) || []);
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

      const layersByVariant = new Map<string, any[]>();
      for (const l of layers) {
        if (!layersByVariant.has(l.variantId)) {
          layersByVariant.set(l.variantId, []);
        }
        layersByVariant.get(l.variantId)!.push({
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

      return variantIds.map((id) => layersByVariant.get(id) || []);
    }),

    externalMappings: new DataLoader<string, any[]>(async (internalIds) => {
      const mappings = await prisma.externalMapping.findMany({
        where: { internalId: { in: internalIds as string[] } },
      });

      const mappingsByInternal = new Map<string, any[]>();
      for (const m of mappings) {
        if (!mappingsByInternal.has(m.internalId)) {
          mappingsByInternal.set(m.internalId, []);
        }
        mappingsByInternal.get(m.internalId)!.push({
          id: m.id,
          tenantId: m.tenantId,
          integrationId: m.integrationId,
          entityType: m.entityType,
          internalId: m.internalId,
          externalId: m.externalId,
          externalSecondaryId: m.externalSecondaryId,
        });
      }

      return internalIds.map((id) => mappingsByInternal.get(id) || []);
    }),
  };
}
