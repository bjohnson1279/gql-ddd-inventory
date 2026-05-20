import { Product } from '../../src/domain/entities/Product';
import { ProductId } from '../../src/domain/valueObjects/ProductId';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../src/domain/valueObjects/VariantAttribute';
import { Kit } from '../../src/domain/entities/Kit';
import { KitId } from '../../src/domain/valueObjects/KitId';
import { InventoryService } from '../../src/domain/services/InventoryService';
import { InMemoryLedgerRepository } from '../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { LedgerEntry } from '../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../src/domain/valueObjects/LedgerEntryId';
import { ReasonCode } from '../../src/domain/enums/ReasonCode';

describe('SKU Variance & Kitting', () => {
  const tenantId = new TenantId('T1');
  const locationId = new LocationId('L1');
  const actorId = new ActorId('U1');

  it('should manage product variants correctly', () => {
    const product = new Product(new ProductId('P1'), 'T-Shirt');
    const v1 = product.addVariant(new Sku('TSHIRT-S-RED'), [
      new VariantAttribute('size', 'S'),
      new VariantAttribute('color', 'red'),
    ]);
    
    expect(product.variants.length).toBe(1);
    expect(v1.sku.value).toBe('TSHIRT-S-RED');

    // Duplicate attributes should throw
    expect(() => product.addVariant(new Sku('TSHIRT-S-RED-ALT'), [
      new VariantAttribute('color', 'red'),
      new VariantAttribute('size', 'S'),
    ])).toThrow('A variant with these attributes already exists');
  });

  it('should decrement stock correctly for kit sale', async () => {
    const ledger = new InMemoryLedgerRepository();
    const inventoryService = new InventoryService(ledger);

    const product = new Product(new ProductId('P1'), 'T-Shirt');
    const v1 = product.addVariant(new Sku('V1'), [new VariantAttribute('size', 'S')]);
    const v2 = product.addVariant(new Sku('V2'), [new VariantAttribute('size', 'M')]);

    // Pre-populate inventory
    await ledger.append(new LedgerEntry(
      new LedgerEntryId('E1'), tenantId, locationId, v1.id, 10, ReasonCode.OpeningBalance, actorId, new Date()
    ));
    await ledger.append(new LedgerEntry(
      new LedgerEntryId('E2'), tenantId, locationId, v2.id, 10, ReasonCode.OpeningBalance, actorId, new Date()
    ));

    const kit = new Kit(new KitId('K1'), new Sku('KIT1'), 'Combo Pack');
    kit.addComponent(v1.id, 1);
    kit.addComponent(v2.id, 2);

    // Act: Sell 3 kits
    await inventoryService.decrementForKitSale(tenantId, locationId, kit, 3, 'S1', actorId);

    // Assert
    expect(await ledger.currentQuantity(v1.id, locationId)).toBe(7); // 10 - (1 * 3)
    expect(await ledger.currentQuantity(v2.id, locationId)).toBe(4); // 10 - (2 * 3)
  });

  it('should throw if any component has insufficient stock', async () => {
    const ledger = new InMemoryLedgerRepository();
    const inventoryService = new InventoryService(ledger);

    const product = new Product(new ProductId('P1'), 'T-Shirt');
    const v1 = product.addVariant(new Sku('V1'), [new VariantAttribute('size', 'S')]);

    await ledger.append(new LedgerEntry(
      new LedgerEntryId('E1'), tenantId, locationId, v1.id, 5, ReasonCode.OpeningBalance, actorId, new Date()
    ));

    const kit = new Kit(new KitId('K1'), new Sku('KIT1'), 'Pack');
    kit.addComponent(v1.id, 2);

    // Try to sell 3 kits (needs 6, only 5 available)
    await expect(inventoryService.decrementForKitSale(tenantId, locationId, kit, 3, 'S1', actorId))
      .rejects.toThrow('Insufficient stock');

    // Verify no stock was decremented (atomic validation)
    expect(await ledger.currentQuantity(v1.id, locationId)).toBe(5);
  });
});
