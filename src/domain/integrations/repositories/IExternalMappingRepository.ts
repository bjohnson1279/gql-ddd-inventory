import { ExternalMapping } from '../entities/ExternalMapping';
import { IntegrationId } from '../valueObjects/IntegrationId';
import { ExternalEntityType } from '../enums/IntegrationEnums';

export interface IExternalMappingRepository {
  save(mapping: ExternalMapping): Promise<void>;
  findByInternalId(integrationId: IntegrationId, internalId: string, entityType: ExternalEntityType): Promise<ExternalMapping | null>;
  findByExternalId(integrationId: IntegrationId, externalId: string, entityType: ExternalEntityType): Promise<ExternalMapping | null>;
  findByExternalIds(integrationId: IntegrationId, externalIds: string[], entityType: ExternalEntityType): Promise<ExternalMapping[]>;
  delete(integrationId: IntegrationId, internalId: string, entityType: ExternalEntityType): Promise<void>;
}
