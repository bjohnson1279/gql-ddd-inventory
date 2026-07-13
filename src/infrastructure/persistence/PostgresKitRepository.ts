import { PrismaClient, Prisma } from '@prisma/client';
import { IKitRepository } from '../../domain/repositories/IKitRepository';
import { Kit } from '../../domain/entities/Kit';
import { KitId } from '../../domain/valueObjects/KitId';
import { Sku } from '../../domain/valueObjects/Sku';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { toUuid } from '../utils/uuid';

type KitModel = Prisma.KitGetPayload<{ include: { components: true } }>;


export class PostgresKitRepository implements IKitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(model: KitModel): Kit {
    const kit = new Kit(
      new KitId(model.id),
      new Sku(model.sku),
      model.name
    );
    // Since addComponent will merge or add, and we read clean from db:
    for (const comp of model.components || []) {
      kit.addComponent(new ProductVariantId(comp.variantId), comp.quantity);
    }
    return kit;
  }

  async save(kit: Kit): Promise<void> {
    const dbId = toUuid(kit.id.value);
    await this.prisma.$transaction(async (tx) => {
      await tx.kit.upsert({
        where: { id: dbId },
        create: {
          id: dbId,
          sku: kit.sku.value,
          name: kit.name
        },
        update: {
          sku: kit.sku.value,
          name: kit.name
        }
      });

      // Clear existing components
      await tx.kitComponent.deleteMany({
        where: { kitId: dbId }
      });

      // Insert new components
      if (kit.components.length > 0) {
        await tx.kitComponent.createMany({
          data: kit.components.map(comp => ({
            kitId: dbId,
            variantId: toUuid(comp.variantId.value),
            quantity: comp.quantity
          }))
        });
      }
    });
  }

  async findById(id: KitId): Promise<Kit | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.kit.findUnique({
      where: { id: dbId },
      include: { components: true }
    });
    if (!model) return null;
    return this.toDomain(model);
  }

  async findByIds(ids: KitId[]): Promise<Kit[]> {
    if (ids.length === 0) return [];
    const dbIds = ids.map(id => toUuid(id.value));
    const models = await this.prisma.kit.findMany({
      where: { id: { in: dbIds } },
      include: { components: true }
    });
    return models.map(m => this.toDomain(m));
  }

  async findBySku(sku: Sku): Promise<Kit | null> {
    const model = await this.prisma.kit.findUnique({
      where: { sku: sku.value },
      include: { components: true }
    });
    if (!model) return null;
    return this.toDomain(model);
  }

  async findBySkus(skus: Sku[]): Promise<Kit[]> {
    if (skus.length === 0) return [];
    const skuStrs = skus.map(s => s.value);
    const models = await this.prisma.kit.findMany({
      where: { sku: { in: skuStrs } },
      include: { components: true }
    });
    return models.map(m => this.toDomain(m));
  }

  async delete(id: KitId): Promise<void> {
    const dbId = toUuid(id.value);
    await this.prisma.kit.delete({
      where: { id: dbId }
    });
  }
}
