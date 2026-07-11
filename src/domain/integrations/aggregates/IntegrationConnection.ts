import { IntegrationId } from '../valueObjects/IntegrationId';
import { TenantId } from '../../valueObjects/TenantId';
import { IntegrationPlatform } from '../enums/IntegrationEnums';

export class IntegrationConnection {
  constructor(
    public readonly id: IntegrationId,
    public readonly tenantId: TenantId,
    public readonly platform: IntegrationPlatform,
    public readonly storeDomain: string,
    public readonly accessToken: string,
    private _isActive: boolean = true
  ) {
    if (!storeDomain.endsWith('.myshopify.com')) {
        throw new Error('Invalid store domain. Must end with .myshopify.com.');
    }
    if (!accessToken || accessToken.trim() === '') {
        throw new Error('Access token cannot be empty.');
    }
  }

  get isActive(): boolean {
    return this._isActive;
  }

  deactivate(): void {
    this._isActive = false;
  }

  activate(): void {
    this._isActive = true;
  }
}
