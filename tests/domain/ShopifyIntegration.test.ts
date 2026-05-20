import { IntegrationConnection } from '../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform, ExternalEntityType } from '../../src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from '../../src/domain/integrations/entities/ExternalMapping';

describe('Shopify Integration Domain', () => {
  const tenantId = new TenantId('T1');
  const integrationId = new IntegrationId('I1');

  it('should create an IntegrationConnection correctly', () => {
    const connection = new IntegrationConnection(
      integrationId,
      tenantId,
      IntegrationPlatform.Shopify,
      'test-store.myshopify.com',
      'token-123'
    );

    expect(connection.storeDomain).toBe('test-store.myshopify.com');
    expect(connection.isActive).toBe(true);
  });

  it('should throw error for invalid Shopify domain', () => {
    expect(() => new IntegrationConnection(
      integrationId,
      tenantId,
      IntegrationPlatform.Shopify,
      'invalid-domain.com',
      'token-123'
    )).toThrow('Invalid store domain');
  });

  it('should create an ExternalMapping correctly', () => {
    const mapping = new ExternalMapping(
      tenantId,
      integrationId,
      ExternalEntityType.Variant,
      'internal-v-1',
      'shopify-v-1',
      'shopify-inv-1'
    );

    expect(mapping.internalId).toBe('internal-v-1');
    expect(mapping.externalId).toBe('shopify-v-1');
    expect(mapping.externalSecondaryId).toBe('shopify-inv-1');
  });
});
