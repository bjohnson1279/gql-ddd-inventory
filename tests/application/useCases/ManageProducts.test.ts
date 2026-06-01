import { AddProductVariantUseCase, CreateProductUseCase } from '../../../src/application/useCases/ManageProducts';
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

  describe('CreateProductUseCase', () => {
    it('should create a product and save it to the repository', async () => {
      const useCase = new CreateProductUseCase(productRepo);

      const result = await useCase.execute('prod-123', 'New Test Product');

      expect(result).toBe(true);
      expect(productRepo.save).toHaveBeenCalledTimes(1);

      const savedProduct = productRepo.save.mock.calls[0][0];
      expect(savedProduct).toBeInstanceOf(Product);
      expect(savedProduct.id.value).toBe('prod-123');
      expect(savedProduct.name).toBe('New Test Product');
    });
  });

  describe('AddProductVariantUseCase', () => {
    it('should throw an error when product is not found', async () => {
      productRepo.findById.mockResolvedValue(null);

      const useCase = new AddProductVariantUseCase(productRepo);

      await expect(useCase.execute({
        productId: 'non-existent-id',
        sku: 'TEST-SKU',
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      })).rejects.toThrow('Product non-existent-id not found.');

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
  });
});
