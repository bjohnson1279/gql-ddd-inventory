import { TenantId } from '../../valueObjects/TenantId';
import { IntegrationId } from '../valueObjects/IntegrationId';
import { ExternalEntityType } from '../enums/IntegrationEnums';

export class ExternalMapping {
  constructor(
    public readonly tenantId: TenantId,
    public readonly integrationId: IntegrationId,
    public readonly entityType: ExternalEntityType,
    public readonly internalId: string,
    public readonly externalId: string,
    public readonly externalSecondaryId?: string
  ) {}
}
