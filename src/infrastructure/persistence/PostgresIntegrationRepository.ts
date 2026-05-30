import { PrismaClient } from '@prisma/client';
import { IIntegrationRepository } from '../../domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../domain/integrations/enums/IntegrationEnums';
import * as crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresIntegrationRepository implements IIntegrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(connection: IntegrationConnection): Promise<void> {
    const dbId = toUuid(connection.id.value);
    await this.prisma.integrationConnection.upsert({
      where: { id: dbId },
      create: {
        id: dbId,
        tenantId: connection.tenantId.value,
        platform: connection.platform,
        storeDomain: connection.storeDomain,
        accessToken: connection.accessToken,
        isActive: connection.isActive,
      },
      update: {
        isActive: connection.isActive,
        accessToken: connection.accessToken,
      },
    });
  }

  async findById(id: IntegrationId): Promise<IntegrationConnection | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.integrationConnection.findUnique({
      where: { id: dbId },
    });
    if (!model) return null;
    return new IntegrationConnection(
      new IntegrationId(model.id),
      new TenantId(model.tenantId),
      model.platform as IntegrationPlatform,
      model.storeDomain,
      model.accessToken,
      model.isActive ?? true
    );
  }

  async findAllByTenant(tenantId: TenantId): Promise<IntegrationConnection[]> {
    const models = await this.prisma.integrationConnection.findMany({
      where: { tenantId: tenantId.value },
    });
    return models.map(
      (model) =>
        new IntegrationConnection(
          new IntegrationId(model.id),
          new TenantId(model.tenantId),
          model.platform as IntegrationPlatform,
          model.storeDomain,
          model.accessToken,
          model.isActive ?? true
        )
    );
  }

  async findByStoreDomain(storeDomain: string): Promise<IntegrationConnection | null> {
    const model = await this.prisma.integrationConnection.findFirst({
      where: { storeDomain },
    });
    if (!model) return null;
    return new IntegrationConnection(
      new IntegrationId(model.id),
      new TenantId(model.tenantId),
      model.platform as IntegrationPlatform,
      model.storeDomain,
      model.accessToken,
      model.isActive ?? true
    );
  }
}
