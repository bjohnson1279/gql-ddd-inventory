import { ProductVariant } from '../../../src/domain/entities/ProductVariant';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttributeSet } from '../../../src/domain/valueObjects/VariantAttributeSet';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';
import { CostingMethod } from '../../../src/domain/enums/AccountingEnums';

describe('ProductVariant', () => {
  const variantId = new ProductVariantId('var-1');
  const productId = new ProductId('prod-1');
  const sku = new Sku('SKU-1');
  const attributes = new VariantAttributeSet([new VariantAttribute('Color', 'Red')]);

  it('should initialize with default parameters when optional parameters are omitted', () => {
    const variant = new ProductVariant(variantId, productId, sku, attributes);

    expect(variant.id).toBe(variantId);
    expect(variant.productId).toBe(productId);
    expect(variant.sku).toBe(sku);
    expect(variant.attributes).toBe(attributes);
    expect(variant.trackingMode).toBe(VariantTrackingMode.Quantity);
    expect(variant.weightGrams).toBe(0);
    expect(variant.volumeCubicMeters).toBe(0);
    expect(variant.costingMethod).toBe(CostingMethod.FIFO);
  });

  it('should initialize with custom parameters when provided', () => {
    const variant = new ProductVariant(
      variantId,
      productId,
      sku,
      attributes,
      VariantTrackingMode.Lot,
      500,
      0.02,
      CostingMethod.LIFO
    );

    expect(variant.trackingMode).toBe(VariantTrackingMode.Lot);
    expect(variant.weightGrams).toBe(500);
    expect(variant.volumeCubicMeters).toBe(0.02);
    expect(variant.costingMethod).toBe(CostingMethod.LIFO);
  });

  it('should allow updating mutable properties trackingMode and costingMethod', () => {
    const variant = new ProductVariant(variantId, productId, sku, attributes);

    variant.trackingMode = VariantTrackingMode.Serial;
    variant.costingMethod = CostingMethod.WeightedAverageCost;

    expect(variant.trackingMode).toBe(VariantTrackingMode.Serial);
    expect(variant.costingMethod).toBe(CostingMethod.WeightedAverageCost);
  });
});
