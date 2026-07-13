import { IReplenishmentRuleRepository } from '../../domain/repositories/IReplenishmentRuleRepository';
import { ReplenishmentRule } from '../../domain/entities/ReplenishmentRule';
import { ReplenishmentRuleId } from '../../domain/valueObjects/ReplenishmentRuleId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class InMemoryReplenishmentRuleRepository implements IReplenishmentRuleRepository {
  private readonly rules: Map<string, ReplenishmentRule> = new Map();

  private cloneRule(rule: ReplenishmentRule): ReplenishmentRule {
    return ReplenishmentRule.reconstruct(
      new ReplenishmentRuleId(rule.id.value),
      new TenantId(rule.tenantId.value),
      new Sku(rule.sku.value),
      new LocationId(rule.locationId.value),
      rule.reorderPoint,
      rule.reorderQuantity,
      rule.safetyStock,
      rule.leadTimeDays,
      rule.replenishmentType,
      rule.sourceLocationId ? new LocationId(rule.sourceLocationId.value) : null,
      rule.supplierId,
      rule.isActive,
      rule.dynamicRopEnabled,
      rule.createdAt,
      rule.updatedAt
    );
  }

  async save(rule: ReplenishmentRule): Promise<void> {
    this.rules.set(rule.id.value, rule);
  }

  async saveBatch(rules: ReplenishmentRule[]): Promise<void> {
    for (const rule of rules) {
      this.rules.set(rule.id.value, rule);
    }
  }

  async findById(id: ReplenishmentRuleId): Promise<ReplenishmentRule | null> {
    const rule = this.rules.get(id.value);
    return rule ? this.cloneRule(rule) : null;
  }

  async findBySkuAndLocation(sku: Sku, locationId: LocationId): Promise<ReplenishmentRule | null> {
    const rule = Array.from(this.rules.values()).find(
      (r) => r.sku.equals(sku) && r.locationId.equals(locationId)
    );
    return rule ? this.cloneRule(rule) : null;
  }

  async findAllByTenant(tenantId: TenantId): Promise<ReplenishmentRule[]> {
    return Array.from(this.rules.values())
      .filter((r) => r.tenantId.equals(tenantId))
      .map((r) => this.cloneRule(r));
  }

  async findAllByLocation(locationId: LocationId): Promise<ReplenishmentRule[]> {
    return Array.from(this.rules.values())
      .filter((r) => r.locationId.equals(locationId))
      .map((r) => this.cloneRule(r));
  }
}
