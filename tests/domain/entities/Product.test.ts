import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { ProductVariant } from '../../../src/domain/entities/ProductVariant';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { VariantAttributeSet } from '../../../src/domain/valueObjects/VariantAttributeSet';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';

describe('Product', () => {
  describe('constructor', () => {
    it('should initialize with minimal parameters', () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      expect(product.id.value).toBe('prod-1');
      expect(product.name).toBe('Test Product');
      expect(product.variants).toHaveLength(0);
    });

    it('should initialize with provided variants map', () => {
      const variant = new ProductVariant(
        new ProductVariantId('var-1'),
        new ProductId('prod-1'),
        new Sku('SKU-1'),
        new VariantAttributeSet([new VariantAttribute('Color', 'Red')]),
        VariantTrackingMode.Lot
      );
      const map = new Map<string, ProductVariant>();
      map.set('var-1', variant);

      const product = new Product(new ProductId('prod-1'), 'Test Product', map);
      expect(product.variants).toHaveLength(1);
      expect(product.findVariantBySku('SKU-1')).toBeDefined();
    });
  });

  describe('addVariant', () => {
    it('should add a variant successfully and invalidate cache', () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      const sku = new Sku('SKU-1');
      const attr = new VariantAttribute('Color', 'Red');

      const variant = product.addVariant(sku, [attr], VariantTrackingMode.Lot);

      expect(variant.sku.value).toBe('SKU-1');
      expect(variant.trackingMode).toBe(VariantTrackingMode.Lot);
      expect(product.variants).toHaveLength(1);
      expect(product.findVariant(variant.id)).toBeDefined();
      expect(product.findVariantBySku(sku)).toBeDefined();
    });

    it('should throw an error when adding a variant with duplicate attributes', () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      const sku1 = new Sku('SKU-1');
      const sku2 = new Sku('SKU-2');
      const attr = new VariantAttribute('Color', 'Red');

      product.addVariant(sku1, [attr]);

      expect(() => {
        product.addVariant(sku2, [attr]);
      }).toThrow('A variant with these attributes already exists on product prod-1.');
    });
  });

  describe('findVariant and findVariantBySku', () => {
    let product: Product;
    let variant: ProductVariant;

    beforeEach(() => {
      product = new Product(new ProductId('prod-1'), 'Test Product');
      variant = product.addVariant(new Sku('SKU-1'), [new VariantAttribute('Color', 'Red')]);
    });

    it('should find variant by id', () => {
      expect(product.findVariant(variant.id)).toBe(variant);
    });

    it('should return undefined for non-existent id', () => {
      expect(product.findVariant(new ProductVariantId('non-existent'))).toBeUndefined();
    });

    it('should find variant by Sku object', () => {
      expect(product.findVariantBySku(new Sku('SKU-1'))).toBe(variant);
    });

    it('should find variant by string sku', () => {
      expect(product.findVariantBySku('SKU-1')).toBe(variant);
    });

    it('should return undefined for non-existent sku', () => {
      expect(product.findVariantBySku('NON-EXISTENT')).toBeUndefined();
    });
  });

  describe('variants getter', () => {
    it('should cache variants array', () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');

      // First access populates cache
      const firstAccess = product.variants;
      expect(firstAccess).toHaveLength(0);

      // Add variant invalidates cache
      product.addVariant(new Sku('SKU-1'), [new VariantAttribute('Color', 'Red')]);

      // Second access repopulates cache
      const secondAccess = product.variants;
      expect(secondAccess).toHaveLength(1);

      // Third access uses cache
      const thirdAccess = product.variants;
      expect(thirdAccess).toBe(secondAccess); // strict equality checks object identity
    });
  });
});
