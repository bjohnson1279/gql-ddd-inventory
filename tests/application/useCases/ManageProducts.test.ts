import { AddProductVariantUseCase } from '../../../src/application/useCases/ManageProducts';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';

describe('ManageProducts Use Cases', () => {
  let productRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    productRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findAll: jest.fn(),
    };
  });

  describe('AddProductVariantUseCase', () => {
    it('should throw an error when the product repo returns null (product not found)', async () => {
      // Mock repository to return null, simulating product not found
      productRepo.findById.mockResolvedValue(null);

      const useCase = new AddProductVariantUseCase(productRepo);

      // Execute use case and assert that it throws the expected error
      await expect(useCase.execute({
        productId: 'non-existent-id',
        sku: 'TEST-SKU',
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      })).rejects.toThrow('Product non-existent-id not found.');

      // Verify findById was called with correct ID and save was never called
      expect(productRepo.findById).toHaveBeenCalledWith(new ProductId('non-existent-id'));
      expect(productRepo.save).not.toHaveBeenCalled();
    });

    it('should add a variant and save the product when product is found', async () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      productRepo.findById.mockResolvedValue(product);

      const useCase = new AddProductVariantUseCase(productRepo);

      const result = await useCase.execute({
        productId: 'prod-1',
        sku: 'TEST-SKU',
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      });

      expect(result).toBe(true);
      expect(product.variants.length).toBe(1);
      expect(product.variants[0].sku.value).toBe('TEST-SKU');
      expect((product.variants[0] as any).trackingMode).toBe(VariantTrackingMode.Quantity);
      expect(productRepo.save).toHaveBeenCalledWith(product);
    });

    it('should throw an error when a variant with the same attributes already exists on the product', async () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      productRepo.findById.mockResolvedValue(product);

      const useCase = new AddProductVariantUseCase(productRepo);

      // Add initial variant
      await useCase.execute({
        productId: 'prod-1',
        sku: 'TEST-SKU-1',
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      });

      // Clear the save mock to verify it's not called on failure
      productRepo.save.mockClear();

      // Attempt to add a variant with the same attributes
      await expect(useCase.execute({
        productId: 'prod-1',
        sku: 'TEST-SKU-2',
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      })).rejects.toThrow('A variant with these attributes already exists on product prod-1.');

      expect(productRepo.save).not.toHaveBeenCalled();
    });
  });
});
