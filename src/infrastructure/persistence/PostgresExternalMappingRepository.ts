import { PrismaClient } from '@prisma/client';
import { IExternalMappingRepository } from '../../domain/integrations/repositories/IExternalMappingRepository';
import { ExternalMapping } from '../../domain/integrations/entities/ExternalMapping';
import { IntegrationId } from '../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { ExternalEntityType } from '../../domain/integrations/enums/IntegrationEnums';
import { toUuid } from '../../shared/utils/uuid';


export class PostgresExternalMappingRepository implements IExternalMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(mapping: ExternalMapping): Promise<void> {
    const dbIntegrationId = toUuid(mapping.integrationId.value);

    const existing = await this.prisma.externalMapping.findUnique({
      where: {
        integrationId_entityType_internalId: {
          integrationId: dbIntegrationId,
          entityType: mapping.entityType,
          internalId: mapping.internalId,
        },
      },
    });

    if (existing) {
      await this.prisma.externalMapping.update({
        where: { id: existing.id },
        data: {
          tenantId: mapping.tenantId.value,
          externalId: mapping.externalId,
          externalSecondaryId: mapping.externalSecondaryId || null,
        },
      });
    } else {
      await this.prisma.externalMapping.create({
        data: {
          tenantId: mapping.tenantId.value,
          integrationId: dbIntegrationId,
          entityType: mapping.entityType,
          internalId: mapping.internalId,
          externalId: mapping.externalId,
          externalSecondaryId: mapping.externalSecondaryId || null,
        },
      });
    }
  }

  async saveBatch(mappings: ExternalMapping[]): Promise<void> {
    if (mappings.length === 0) return;

    await this.prisma.$transaction(
      mappings.map((mapping) => {
        const dbIntegrationId = toUuid(mapping.integrationId.value);
        return this.prisma.externalMapping.upsert({
          where: {
            integrationId_entityType_internalId: {
              integrationId: dbIntegrationId,
              entityType: mapping.entityType,
              internalId: mapping.internalId,
            },
          },
          update: {
            tenantId: mapping.tenantId.value,
            externalId: mapping.externalId,
            externalSecondaryId: mapping.externalSecondaryId || null,
          },
          create: {
            tenantId: mapping.tenantId.value,
            integrationId: dbIntegrationId,
            entityType: mapping.entityType,
            internalId: mapping.internalId,
            externalId: mapping.externalId,
            externalSecondaryId: mapping.externalSecondaryId || null,
          },
        });
      })
    );
  }

  async findByInternalId(
    integrationId: IntegrationId,
    internalId: string,
    entityType: ExternalEntityType
  ): Promise<ExternalMapping | null> {
    const dbIntegrationId = toUuid(integrationId.value);
    const model = await this.prisma.externalMapping.findUnique({
      where: {
        integrationId_entityType_internalId: {
          integrationId: dbIntegrationId,
          entityType: entityType,
          internalId: internalId,
        },
      },
    });
    if (!model) return null;
    return new ExternalMapping(
      new TenantId(model.tenantId),
      new IntegrationId(model.integrationId),
      model.entityType as ExternalEntityType,
      model.internalId,
      model.externalId,
      model.externalSecondaryId || undefined
    );
  }

  async findManyByInternalId(
    integrationIds: IntegrationId[],
    internalId: string,
    entityType: ExternalEntityType
  ): Promise<ExternalMapping[]> {
    if (integrationIds.length === 0) return [];

    const dbIntegrationIds = integrationIds.map(id => toUuid(id.value));
    const models = await this.prisma.externalMapping.findMany({
      where: {
        integrationId: { in: dbIntegrationIds },
        entityType: entityType,
        internalId: internalId,
      },
    });

    return models.map(model => new ExternalMapping(
      new TenantId(model.tenantId),
      new IntegrationId(model.integrationId),
      model.entityType as ExternalEntityType,
      model.internalId,
      model.externalId,
      model.externalSecondaryId || undefined
    ));
  }

  async findByExternalId(
    integrationId: IntegrationId,
    externalId: string,
    entityType: ExternalEntityType
  ): Promise<ExternalMapping | null> {
    const dbIntegrationId = toUuid(integrationId.value);
    const model = await this.prisma.externalMapping.findUnique({
      where: {
        integrationId_entityType_externalId: {
          integrationId: dbIntegrationId,
          entityType: entityType,
          externalId: externalId,
        },
      },
    });
    if (!model) return null;
    return new ExternalMapping(
      new TenantId(model.tenantId),
      new IntegrationId(model.integrationId),
      model.entityType as ExternalEntityType,
      model.internalId,
      model.externalId,
      model.externalSecondaryId || undefined
    );
  }

  async findByExternalIds(
    integrationId: IntegrationId,
    externalIds: string[],
    entityType: ExternalEntityType
  ): Promise<ExternalMapping[]> {
    if (externalIds.length === 0) return [];

    const dbIntegrationId = toUuid(integrationId.value);
    const models = await this.prisma.externalMapping.findMany({
      where: {
        integrationId: dbIntegrationId,
        entityType: entityType,
        externalId: { in: externalIds },
      },
    });

    return models.map(model => new ExternalMapping(
      new TenantId(model.tenantId),
      new IntegrationId(model.integrationId),
      model.entityType as ExternalEntityType,
      model.internalId,
      model.externalId,
      model.externalSecondaryId || undefined
    ));
  }

  async delete(
    integrationId: IntegrationId,
    internalId: string,
    entityType: ExternalEntityType
  ): Promise<void> {
    const dbIntegrationId = toUuid(integrationId.value);
    try {
      await this.prisma.externalMapping.delete({
        where: {
          integrationId_entityType_internalId: {
            integrationId: dbIntegrationId,
            entityType: entityType,
            internalId: internalId,
          },
        },
      });
    } catch (e: any) {
      // Ignore if mapping already deleted
    }
  }
}
