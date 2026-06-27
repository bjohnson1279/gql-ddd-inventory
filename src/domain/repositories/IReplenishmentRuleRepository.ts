import { ReplenishmentRule } from '../entities/ReplenishmentRule';
import { ReplenishmentRuleId } from '../valueObjects/ReplenishmentRuleId';
import { TenantId } from '../valueObjects/TenantId';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';

export interface IReplenishmentRuleRepository {
  save(rule: ReplenishmentRule): Promise<void>;
  findById(id: ReplenishmentRuleId): Promise<ReplenishmentRule | null>;
  findBySkuAndLocation(sku: Sku, locationId: LocationId): Promise<ReplenishmentRule | null>;
  findAllByTenant(tenantId: TenantId): Promise<ReplenishmentRule[]>;
  saveBatch(rules: ReplenishmentRule[]): Promise<void>;
}
