import { AddProductVariantUseCase, CreateProductUseCase, GetProductsUseCase, GetProductByIdUseCase } from '../../../src/application/useCases/ManageProducts';
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
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      findAll: jest.fn(),
    };
  });

  describe('CreateProductUseCase', () => {
    it('should instantiate a Product entity and save it using the repository', async () => {
      const useCase = new CreateProductUseCase(productRepo);

      const result = await useCase.execute('new-prod-id', 'Another Test Product');

      expect(result).toBe(true);
      expect(productRepo.save).toHaveBeenCalledTimes(1);

      const savedProduct = productRepo.save.mock.calls[0][0];
      expect(savedProduct).toBeInstanceOf(Product);
      expect(savedProduct.id.value).toBe('new-prod-id');
      expect(savedProduct.name).toBe('Another Test Product');
    });

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

    it('should successfully instantiate and save a Product entity via the mocked repository', async () => {
      const useCase = new CreateProductUseCase(productRepo);

      const result = await useCase.execute('mocked-prod-id', 'Mocked Product Name');

      expect(result).toBe(true);
      expect(productRepo.save).toHaveBeenCalledTimes(1);

      const savedProduct = productRepo.save.mock.calls[0][0];
      expect(savedProduct).toBeInstanceOf(Product);
      expect(savedProduct.id.value).toBe('mocked-prod-id');
      expect(savedProduct.name).toBe('Mocked Product Name');
    });

    it('should throw an error if the product id is empty', async () => {
      const useCase = new CreateProductUseCase(productRepo);

      await expect(useCase.execute('', 'New Test Product')).rejects.toThrow('ProductId cannot be empty.');

      expect(productRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors thrown by the repository during save', async () => {
      const useCase = new CreateProductUseCase(productRepo);
      const dbError = new Error('Database connection failed');

      productRepo.save.mockRejectedValue(dbError);

      await expect(useCase.execute('prod-123', 'New Test Product')).rejects.toThrow('Database connection failed');

      expect(productRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('AddProductVariantUseCase', () => {
    it('should propagate errors thrown by the repository during save', async () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      productRepo.findById.mockResolvedValue(product);

      const dbError = new Error('Database connection failed');
      productRepo.save.mockRejectedValue(dbError);

      const useCase = new AddProductVariantUseCase(productRepo);

      await expect(useCase.execute({
        productId: 'prod-1',
        sku: 'TEST-SKU',
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      })).rejects.toThrow('Database connection failed');

      expect(productRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should propagate domain validation errors when SKU is invalid', async () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      productRepo.findById.mockResolvedValue(product);

      const useCase = new AddProductVariantUseCase(productRepo);

      // Sku enforces validation (e.g., must not be empty)
      await expect(useCase.execute({
        productId: 'prod-1',
        sku: '', // Invalid empty SKU
        attributes: [{ name: 'Color', value: 'Red' }],
        trackingMode: VariantTrackingMode.Quantity
      })).rejects.toThrow('SKU cannot be empty.');

      expect(productRepo.save).not.toHaveBeenCalled();
    });

    it('should throw an Error when the requested productId does not exist in the repository', async () => {
      // Setup
      productRepo.findById.mockResolvedValue(null);
      const useCase = new AddProductVariantUseCase(productRepo);

      const input = {
        productId: 'missing-product-id',
        sku: 'TEST-SKU-NEW',
        attributes: [{ name: 'Size', value: 'Large' }],
        trackingMode: VariantTrackingMode.Quantity
      };

      // Execute & Assert
      await expect(useCase.execute(input)).rejects.toThrow('Product missing-product-id not found.');
      expect(productRepo.findById).toHaveBeenCalledWith(new ProductId('missing-product-id'));
      expect(productRepo.save).not.toHaveBeenCalled();
    });

    // Covers product not found error path
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

  describe('GetProductsUseCase', () => {
    it('should return all products from the repository', async () => {
      const product1 = new Product(new ProductId('prod-1'), 'Product 1');
      const product2 = new Product(new ProductId('prod-2'), 'Product 2');
      productRepo.findAll.mockResolvedValue([product1, product2]);

      const useCase = new GetProductsUseCase(productRepo);
      const result = await useCase.execute();

      expect(productRepo.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([product1, product2]);
    });
  });

  describe('GetProductByIdUseCase', () => {
    it('should return the product when found', async () => {
      const product = new Product(new ProductId('prod-1'), 'Test Product');
      productRepo.findById.mockResolvedValue(product);

      const useCase = new GetProductByIdUseCase(productRepo);
      const result = await useCase.execute('prod-1');

      expect(productRepo.findById).toHaveBeenCalledWith(new ProductId('prod-1'));
      expect(result).toBe(product);
    });

    it('should return null when product is not found', async () => {
      productRepo.findById.mockResolvedValue(null);

      const useCase = new GetProductByIdUseCase(productRepo);
      const result = await useCase.execute('non-existent-id');

      expect(productRepo.findById).toHaveBeenCalledWith(new ProductId('non-existent-id'));
      expect(result).toBeNull();
    });
  });
});
