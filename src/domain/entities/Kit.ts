import { KitId } from '../valueObjects/KitId';
import { Sku } from '../valueObjects/Sku';
import { KitComponent } from '../valueObjects/KitComponent';
import { ProductVariantId } from '../valueObjects/ProductVariantId';

export class Kit {
  private _components: KitComponent[] = [];

  constructor(
    public readonly id: KitId,
    public readonly sku: Sku,
    public readonly name: string
  ) {}

  addComponent(variantId: ProductVariantId, quantity: number): void {
    const existingIndex = this._components.findIndex(c => c.variantId.equals(variantId));
    if (existingIndex !== -1) {
      const existing = this._components[existingIndex];
      this._components[existingIndex] = new KitComponent(variantId, existing.quantity + quantity);
    } else {
      this._components.push(new KitComponent(variantId, quantity));
    }
  }

  get components(): KitComponent[] {
    return [...this._components];
  }

  get isEmpty(): boolean {
    return this._components.length === 0;
  }
}
