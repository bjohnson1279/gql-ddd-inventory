import { InventoryItem } from '../../src/domain/entities/InventoryItem';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { Quantity } from '../../src/domain/valueObjects/Quantity';
import { LocationId } from '../../src/domain/valueObjects/LocationId';

export class InventoryItemFactory {
  private id: string = 'test-id';
  private sku: string = 'TEST-SKU';
  private locationId: string = 'LOC-1';
  private quantity: number = 0;

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withSku(sku: string): this {
    this.sku = sku;
    return this;
  }

  withLocationId(locationId: string): this {
    this.locationId = locationId;
    return this;
  }

  withQuantity(quantity: number): this {
    this.quantity = quantity;
    return this;
  }

  build(): InventoryItem {
    return new InventoryItem(
      this.id,
      new Sku(this.sku),
      new LocationId(this.locationId),
      new Quantity(this.quantity)
    );
  }

  static createDefault(): InventoryItem {
    return new InventoryItemFactory().build();
  }
}
