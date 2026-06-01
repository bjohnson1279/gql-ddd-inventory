import { PrismaClient, Prisma } from '@prisma/client';
import { IKitRepository } from '../../domain/repositories/IKitRepository';
import { Kit } from '../../domain/entities/Kit';
import { KitId } from '../../domain/valueObjects/KitId';
import { Sku } from '../../domain/valueObjects/Sku';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import * as crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresKitRepository implements IKitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(model: Prisma.KitGetPayload<{ include: { components: true } }>): Kit {
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

  async findBySku(sku: Sku): Promise<Kit | null> {
    const model = await this.prisma.kit.findUnique({
      where: { sku: sku.value },
      include: { components: true }
    });
    if (!model) return null;
    return this.toDomain(model);
  }

  async delete(id: KitId): Promise<void> {
    const dbId = toUuid(id.value);
    await this.prisma.kit.delete({
      where: { id: dbId }
    });
  }
}
