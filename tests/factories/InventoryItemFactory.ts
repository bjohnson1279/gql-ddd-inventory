import { InventoryItem } from '../../src/domain/entities/InventoryItem';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { Quantity } from '../../src/domain/valueObjects/Quantity';

export class InventoryItemFactory {
  private id: string = 'test-id';
  private sku: string = 'TEST-SKU';
  private quantity: number = 0;

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withSku(sku: string): this {
    this.sku = sku;
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
      new Quantity(this.quantity)
    );
  }

  static createDefault(): InventoryItem {
    return new InventoryItemFactory().build();
  }
}
