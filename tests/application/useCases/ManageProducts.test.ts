import { CreateProductUseCase } from '../../../src/application/useCases/ManageProducts';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { Product } from '../../../src/domain/entities/Product';

describe('ManageProducts Use Cases', () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    mockProductRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findAll: jest.fn(),
    };
  });

  describe('CreateProductUseCase', () => {
    it('should successfully create a product and save it to the repository', async () => {
      const useCase = new CreateProductUseCase(mockProductRepo);
      const productId = 'prod-123';
      const productName = 'Test Product';

      const result = await useCase.execute(productId, productName);

      expect(result).toBe(true);
      expect(mockProductRepo.save).toHaveBeenCalledTimes(1);

      const savedProduct = mockProductRepo.save.mock.calls[0][0];
      expect(savedProduct).toBeInstanceOf(Product);
      expect(savedProduct.id.value).toBe(productId);
      expect(savedProduct.name).toBe(productName);
    });
  });
});
