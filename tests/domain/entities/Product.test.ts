import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';
import { ProductVariant } from '../../../src/domain/entities/ProductVariant';
import { VariantAttributeSet } from '../../../src/domain/valueObjects/VariantAttributeSet';

describe('Product', () => {
  it('should create a product with valid parameters', () => {
    const id = new ProductId('prod-1');
    const product = new Product(id, 'Test Product');
    expect(product.id.value).toBe('prod-1');
    expect(product.name).toBe('Test Product');
    expect(product.variants).toEqual([]);
  });

  describe('addVariant', () => {
    it('should add a valid variant', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');
      const sku = new Sku('TEST-SKU-1');
      const attributes = [new VariantAttribute('Color', 'Red')];

      const variant = product.addVariant(sku, attributes, VariantTrackingMode.Lot);

      expect(variant.sku.value).toBe('TEST-SKU-1');
      expect(variant.productId.value).toBe('prod-1');
      expect(variant.trackingMode).toBe(VariantTrackingMode.Lot);
      expect(variant.attributes.all()).toEqual(attributes);

      expect(product.variants).toHaveLength(1);
      expect(product.variants[0]).toBe(variant);
    });

    it('should throw an error if a variant with the same attributes already exists', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');
      const sku1 = new Sku('TEST-SKU-1');
      const sku2 = new Sku('TEST-SKU-2');
      const attributes = [new VariantAttribute('Color', 'Red')];

      product.addVariant(sku1, attributes, VariantTrackingMode.Quantity);

      expect(() => {
        product.addVariant(sku2, attributes, VariantTrackingMode.Quantity);
      }).toThrow(`A variant with these attributes already exists on product prod-1.`);
    });
  });

  describe('findVariant', () => {
    it('should find an existing variant by ID', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');
      const sku = new Sku('TEST-SKU-1');
      const attributes = [new VariantAttribute('Color', 'Red')];

      const variant = product.addVariant(sku, attributes, VariantTrackingMode.Quantity);

      const foundVariant = product.findVariant(variant.id);
      expect(foundVariant).toBe(variant);
    });

    it('should return undefined for a non-existent variant ID', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');

      const foundVariant = product.findVariant(new ProductVariantId('non-existent-id'));
      expect(foundVariant).toBeUndefined();
    });
  });

  describe('findVariantBySku', () => {
    it('should find an existing variant by Sku object', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');
      const sku = new Sku('TEST-SKU-1');
      const attributes = [new VariantAttribute('Color', 'Red')];

      const variant = product.addVariant(sku, attributes, VariantTrackingMode.Quantity);

      const foundVariant = product.findVariantBySku(sku);
      expect(foundVariant).toBe(variant);
    });

    it('should find an existing variant by SKU string', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');
      const sku = new Sku('TEST-SKU-1');
      const attributes = [new VariantAttribute('Color', 'Red')];

      const variant = product.addVariant(sku, attributes, VariantTrackingMode.Quantity);

      const foundVariant = product.findVariantBySku('TEST-SKU-1');
      expect(foundVariant).toBe(variant);
    });

    it('should return undefined for a non-existent SKU', () => {
      const id = new ProductId('prod-1');
      const product = new Product(id, 'Test Product');

      const foundVariant = product.findVariantBySku('NON-EXISTENT-SKU');
      expect(foundVariant).toBeUndefined();
    });
  });

  describe('constructor with variants', () => {
    it('should populate variants and variantsBySku from provided map', () => {
      const id = new ProductId('prod-1');
      const variantId = new ProductVariantId('var-1');
      const sku = new Sku('TEST-SKU-1');
      const attributes = new VariantAttributeSet([new VariantAttribute('Color', 'Red')]);
      const variant = new ProductVariant(variantId, id, sku, attributes);

      const variantsMap = new Map<string, ProductVariant>();
      variantsMap.set(variant.id.value, variant);

      const product = new Product(id, 'Test Product', variantsMap);

      expect(product.variants).toHaveLength(1);
      expect(product.variants[0]).toBe(variant);
      expect(product.findVariantBySku('TEST-SKU-1')).toBe(variant);
    });
  });
});
