import { ReplenishmentRule } from '../../src/domain/entities/ReplenishmentRule';
import { ReplenishmentRuleId } from '../../src/domain/valueObjects/ReplenishmentRuleId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ReplenishmentType } from '../../src/domain/enums/ReplenishmentType';

describe('ReplenishmentRule Aggregate Root', () => {
  const id = new ReplenishmentRuleId('rule-1');
  const tenantId = new TenantId('T1');
  const sku = new Sku('SKU-1');
  const loc = new LocationId('LOC-A');
  const sourceLoc = new LocationId('LOC-B');

  it('should initialize transfer rule correctly', () => {
    const rule = ReplenishmentRule.createNew(
      id,
      tenantId,
      sku,
      loc,
      10,
      50,
      5,
      7,
      ReplenishmentType.Transfer,
      sourceLoc,
      null,
      false
    );

    expect(rule.id.value).toBe('rule-1');
    expect(rule.sku.value).toBe('SKU-1');
    expect(rule.reorderPoint).toBe(10);
    expect(rule.reorderQuantity).toBe(50);
    expect(rule.safetyStock).toBe(5);
    expect(rule.leadTimeDays).toBe(7);
    expect(rule.replenishmentType).toBe(ReplenishmentType.Transfer);
    expect(rule.sourceLocationId!.value).toBe('LOC-B');
    expect(rule.supplierId).toBeNull();
    expect(rule.isActive).toBe(true);
    expect(rule.dynamicRopEnabled).toBe(false);
  });

  it('should initialize supplier rule correctly', () => {
    const rule = ReplenishmentRule.createNew(
      id,
      tenantId,
      sku,
      loc,
      20,
      100,
      10,
      14,
      ReplenishmentType.Supplier,
      null,
      'SUPP-123',
      true
    );

    expect(rule.replenishmentType).toBe(ReplenishmentType.Supplier);
    expect(rule.supplierId).toBe('SUPP-123');
    expect(rule.sourceLocationId).toBeNull();
    expect(rule.dynamicRopEnabled).toBe(true);
  });

  it('should throw error on invalid numeric configurations', () => {
    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, -1, 50, 5, 7, ReplenishmentType.Transfer, sourceLoc);
    }).toThrow('Reorder point cannot be negative.');

    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, 10, 0, 5, 7, ReplenishmentType.Transfer, sourceLoc);
    }).toThrow('Reorder quantity must be positive.');

    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, 10, 50, -2, 7, ReplenishmentType.Transfer, sourceLoc);
    }).toThrow('Safety stock cannot be negative.');

    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, 10, 50, 5, -1, ReplenishmentType.Transfer, sourceLoc);
    }).toThrow('Lead time days cannot be negative.');
  });

  it('should throw error if transfer replenishment does not define source location or is duplicate', () => {
    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, 10, 50, 5, 7, ReplenishmentType.Transfer, null);
    }).toThrow('Source location is required for transfer replenishment.');

    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, 10, 50, 5, 7, ReplenishmentType.Transfer, loc);
    }).toThrow('Source location cannot be the same as the destination location.');
  });

  it('should throw error if supplier replenishment does not define supplier ID', () => {
    expect(() => {
      new ReplenishmentRule(id, tenantId, sku, loc, 10, 50, 5, 7, ReplenishmentType.Supplier, null, null);
    }).toThrow('Supplier ID is required for supplier replenishment.');
  });

  it('should support updating configuration values', () => {
    const rule = ReplenishmentRule.createNew(
      id,
      tenantId,
      sku,
      loc,
      10,
      50,
      5,
      7,
      ReplenishmentType.Transfer,
      sourceLoc
    );

    rule.updateConfiguration(40, 8, 10, true, 15);
    expect(rule.reorderQuantity).toBe(40);
    expect(rule.safetyStock).toBe(8);
    expect(rule.leadTimeDays).toBe(10);
    expect(rule.dynamicRopEnabled).toBe(true);
    expect(rule.reorderPoint).toBe(15);
  });

  it('should support toggle active status', () => {
    const rule = ReplenishmentRule.createNew(
      id,
      tenantId,
      sku,
      loc,
      10,
      50,
      5,
      7,
      ReplenishmentType.Transfer,
      sourceLoc
    );

    expect(rule.isActive).toBe(true);
    rule.toggleActive(false);
    expect(rule.isActive).toBe(false);
  });
});
