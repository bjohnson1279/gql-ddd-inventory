import { IntegrationConnection } from '../../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../../../src/domain/integrations/enums/IntegrationEnums';

describe('IntegrationConnection', () => {
  it('should correctly handle activation and deactivation', () => {
    const connection = new IntegrationConnection(
      new IntegrationId('int-123'),
      new TenantId('tenant-123'),
      IntegrationPlatform.Shopify,
      'test-store.myshopify.com',
      'shpat_1234567890'
    );

    expect(connection.isActive).toBe(true);

    connection.deactivate();
    expect(connection.isActive).toBe(false);

    connection.activate();
    expect(connection.isActive).toBe(true);
  });

  it('should throw an error if the store domain is not a valid shopify domain', () => {
    expect(() => {
      new IntegrationConnection(
        new IntegrationId('int-123'),
        new TenantId('tenant-123'),
        IntegrationPlatform.Shopify,
        'invalid-domain.com',
        'shpat_1234567890'
      );
    }).toThrow('Invalid store domain. Must end with .myshopify.com.');
  });

  it('should throw an error if the access token is empty', () => {
    expect(() => {
      new IntegrationConnection(
        new IntegrationId('int-123'),
        new TenantId('tenant-123'),
        IntegrationPlatform.Shopify,
        'test-store.myshopify.com',
        ''
      );
    }).toThrow('Access token cannot be empty.');

    expect(() => {
      new IntegrationConnection(
        new IntegrationId('int-123'),
        new TenantId('tenant-123'),
        IntegrationPlatform.Shopify,
        'test-store.myshopify.com',
        '   '
      );
    }).toThrow('Access token cannot be empty.');
  });
});
