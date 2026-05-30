import { PrismaClient } from '@prisma/client';
import { IExternalMappingRepository } from '../../domain/integrations/repositories/IExternalMappingRepository';
import { ExternalMapping } from '../../domain/integrations/entities/ExternalMapping';
import { IntegrationId } from '../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { ExternalEntityType } from '../../domain/integrations/enums/IntegrationEnums';
import * as crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

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
