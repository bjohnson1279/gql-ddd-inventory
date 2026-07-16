import { PrismaClient } from '@prisma/client';
import { IReplenishmentRuleRepository } from '../../domain/repositories/IReplenishmentRuleRepository';
import { ReplenishmentRule } from '../../domain/entities/ReplenishmentRule';
import { ReplenishmentRuleId } from '../../domain/valueObjects/ReplenishmentRuleId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ReplenishmentType } from '../../domain/enums/ReplenishmentType';
import { toUuid } from '../utils/uuid';


export class PostgresReplenishmentRuleRepository implements IReplenishmentRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveBatch(rules: ReplenishmentRule[]): Promise<void> {
    if (rules.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const rule of rules) {
        const dbId = toUuid(rule.id.value);
        await tx.replenishmentRule.upsert({
          where: { id: dbId },
          create: {
            id: dbId,
            tenantId: rule.tenantId.value,
            sku: rule.sku.value,
            locationId: rule.locationId.value,
            reorderPoint: rule.reorderPoint,
            reorderQuantity: rule.reorderQuantity,
            safetyStock: rule.safetyStock,
            leadTimeDays: rule.leadTimeDays,
            replenishmentType: rule.replenishmentType,
            sourceLocationId: rule.sourceLocationId ? rule.sourceLocationId.value : null,
            supplierId: rule.supplierId,
            isActive: rule.isActive,
            dynamicRopEnabled: rule.dynamicRopEnabled,
          },
          update: {
            reorderPoint: rule.reorderPoint,
            reorderQuantity: rule.reorderQuantity,
            safetyStock: rule.safetyStock,
            leadTimeDays: rule.leadTimeDays,
            isActive: rule.isActive,
            dynamicRopEnabled: rule.dynamicRopEnabled,
          },
        });
      }
    });
  }

  async save(rule: ReplenishmentRule): Promise<void> {
    const dbId = toUuid(rule.id.value);

    await this.prisma.replenishmentRule.upsert({
      where: { id: dbId },
      create: {
        id: dbId,
        tenantId: rule.tenantId.value,
        sku: rule.sku.value,
        locationId: rule.locationId.value,
        reorderPoint: rule.reorderPoint,
        reorderQuantity: rule.reorderQuantity,
        safetyStock: rule.safetyStock,
        leadTimeDays: rule.leadTimeDays,
        replenishmentType: rule.replenishmentType,
        sourceLocationId: rule.sourceLocationId ? rule.sourceLocationId.value : null,
        supplierId: rule.supplierId,
        isActive: rule.isActive,
        dynamicRopEnabled: rule.dynamicRopEnabled,
      },
      update: {
        reorderPoint: rule.reorderPoint,
        reorderQuantity: rule.reorderQuantity,
        safetyStock: rule.safetyStock,
        leadTimeDays: rule.leadTimeDays,
        isActive: rule.isActive,
        dynamicRopEnabled: rule.dynamicRopEnabled,
      },
    });
  }

  async findById(id: ReplenishmentRuleId): Promise<ReplenishmentRule | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.replenishmentRule.findUnique({
      where: { id: dbId },
    });

    if (!model) return null;

    return ReplenishmentRule.reconstruct(
      new ReplenishmentRuleId(model.id),
      new TenantId(model.tenantId),
      new Sku(model.sku),
      new LocationId(model.locationId),
      model.reorderPoint,
      model.reorderQuantity,
      model.safetyStock,
      model.leadTimeDays,
      model.replenishmentType as ReplenishmentType,
      model.sourceLocationId ? new LocationId(model.sourceLocationId) : null,
      model.supplierId,
      model.isActive,
      model.dynamicRopEnabled,
      model.createdAt,
      model.updatedAt
    );
  }

  async findBySkuAndLocation(sku: Sku, locationId: LocationId): Promise<ReplenishmentRule | null> {
    // There is no unique index on sku+locationId alone since the unique constraint includes tenantId.
    // So we search for the first matching rule.
    const model = await this.prisma.replenishmentRule.findFirst({
      where: {
        sku: sku.value,
        locationId: locationId.value,
      },
    });

    if (!model) return null;

    return ReplenishmentRule.reconstruct(
      new ReplenishmentRuleId(model.id),
      new TenantId(model.tenantId),
      new Sku(model.sku),
      new LocationId(model.locationId),
      model.reorderPoint,
      model.reorderQuantity,
      model.safetyStock,
      model.leadTimeDays,
      model.replenishmentType as ReplenishmentType,
      model.sourceLocationId ? new LocationId(model.sourceLocationId) : null,
      model.supplierId,
      model.isActive,
      model.dynamicRopEnabled,
      model.createdAt,
      model.updatedAt
    );
  }

  async findAllByTenant(tenantId: TenantId): Promise<ReplenishmentRule[]> {
    const models = await this.prisma.replenishmentRule.findMany({
      where: { tenantId: tenantId.value },
      orderBy: { createdAt: 'desc' },
    });

    return models.map((model) =>
      ReplenishmentRule.reconstruct(
        new ReplenishmentRuleId(model.id),
        new TenantId(model.tenantId),
        new Sku(model.sku),
        new LocationId(model.locationId),
        model.reorderPoint,
        model.reorderQuantity,
        model.safetyStock,
        model.leadTimeDays,
        model.replenishmentType as ReplenishmentType,
        model.sourceLocationId ? new LocationId(model.sourceLocationId) : null,
        model.supplierId,
        model.isActive,
        model.dynamicRopEnabled,
        model.createdAt,
        model.updatedAt
      )
    );
  }

  async findAllByLocation(locationId: LocationId): Promise<ReplenishmentRule[]> {
    const models = await this.prisma.replenishmentRule.findMany({
      where: { locationId: locationId.value },
      orderBy: { createdAt: 'desc' },
    });

    return models.map((model) =>
      ReplenishmentRule.reconstruct(
        new ReplenishmentRuleId(model.id),
        new TenantId(model.tenantId),
        new Sku(model.sku),
        new LocationId(model.locationId),
        model.reorderPoint,
        model.reorderQuantity,
        model.safetyStock,
        model.leadTimeDays,
        model.replenishmentType as ReplenishmentType,
        model.sourceLocationId ? new LocationId(model.sourceLocationId) : null,
        model.supplierId,
        model.isActive,
        model.dynamicRopEnabled,
        model.createdAt,
        model.updatedAt
      )
    );
  }
}
