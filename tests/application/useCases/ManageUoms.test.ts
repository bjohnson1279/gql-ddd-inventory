import { ConfigureProductUomUseCase, GetProductUomConfigurationUseCase, ConfigureUomInput } from '../../../src/application/useCases/ManageUoms';
import { IProductUomConfigurationRepository } from '../../../src/domain/repositories/IProductUomConfigurationRepository';
import { UomCategory } from '../../../src/domain/enums/UomCategory';
import { ProductUomConfiguration } from '../../../src/domain/entities/ProductUomConfiguration';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';

describe('ManageUoms Use Cases', () => {
  let mockUomRepo: jest.Mocked<IProductUomConfigurationRepository>;

  beforeEach(() => {
    mockUomRepo = {
      save: jest.fn(),
      findBySku: jest.fn(),
    };
  });

  describe('ConfigureProductUomUseCase', () => {
    it('should correctly create and save a ProductUomConfiguration with only base unit', async () => {
      const useCase = new ConfigureProductUomUseCase(mockUomRepo);

      const input: ConfigureUomInput = {
        sku: 'SKU-123',
        baseUnit: {
          name: 'Each',
          abbreviation: 'ea',
          category: UomCategory.Discrete
        },
        conversionRules: []
      };

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);

      const savedConfig = mockUomRepo.save.mock.calls[0][0] as ProductUomConfiguration;
      expect(savedConfig).toBeInstanceOf(ProductUomConfiguration);
      expect(savedConfig.sku.value).toBe('SKU-123');
      expect(savedConfig.baseUnit.name).toBe('Each');
      expect(savedConfig.conversionRules).toHaveLength(0);
      expect(savedConfig.purchaseUnit.name).toBe('Each');
      expect(savedConfig.saleUnit.name).toBe('Each');
    });

    it('should correctly create and save a ProductUomConfiguration with conversion rules', async () => {
      const useCase = new ConfigureProductUomUseCase(mockUomRepo);

      const input: ConfigureUomInput = {
        sku: 'SKU-123',
        baseUnit: {
          name: 'Each',
          abbreviation: 'ea',
          category: UomCategory.Discrete
        },
        conversionRules: [
          {
            unit: {
              name: 'Dozen',
              abbreviation: 'dz',
              category: UomCategory.Discrete
            },
            factorToBase: 12,
            label: 'A Dozen'
          }
        ]
      };

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);

      const savedConfig = mockUomRepo.save.mock.calls[0][0] as ProductUomConfiguration;
      expect(savedConfig.conversionRules).toHaveLength(1);
      const rule = savedConfig.conversionRules[0];
      expect(rule.unit.name).toBe('Dozen');
      expect(rule.factorToBase).toBe(12);
      expect(rule.label).toBe('A Dozen');
    });

    it('should set purchase and sale units when provided', async () => {
      const useCase = new ConfigureProductUomUseCase(mockUomRepo);

      const input: ConfigureUomInput = {
        sku: 'SKU-123',
        baseUnit: {
          name: 'Each',
          abbreviation: 'ea',
          category: UomCategory.Discrete
        },
        purchaseUnit: {
            name: 'Box',
            abbreviation: 'box',
            category: UomCategory.Discrete
        },
        saleUnit: {
            name: 'Pack',
            abbreviation: 'pk',
            category: UomCategory.Discrete
        },
        conversionRules: [
          {
            unit: {
              name: 'Box',
              abbreviation: 'box',
              category: UomCategory.Discrete
            },
            factorToBase: 100,
            label: 'A Box'
          },
          {
            unit: {
              name: 'Pack',
              abbreviation: 'pk',
              category: UomCategory.Discrete
            },
            factorToBase: 10,
            label: 'A Pack'
          }
        ]
      };

      const result = await useCase.execute(input);

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);

      const savedConfig = mockUomRepo.save.mock.calls[0][0] as ProductUomConfiguration;
      expect(savedConfig.purchaseUnit.name).toBe('Box');
      expect(savedConfig.saleUnit.name).toBe('Pack');
    });
  });

  describe('GetProductUomConfigurationUseCase', () => {
    it('should return null if no config is found', async () => {
      mockUomRepo.findBySku.mockResolvedValue(null);
      const useCase = new GetProductUomConfigurationUseCase(mockUomRepo);

      const result = await useCase.execute('SKU-123');

      expect(result).toBeNull();
      expect(mockUomRepo.findBySku).toHaveBeenCalledTimes(1);

      const querySku = mockUomRepo.findBySku.mock.calls[0][0] as Sku;
      expect(querySku.value).toBe('SKU-123');
    });

    it('should return the config if found', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      mockUomRepo.findBySku.mockResolvedValue(config);

      const useCase = new GetProductUomConfigurationUseCase(mockUomRepo);

      const result = await useCase.execute('SKU-123');

      expect(result).toBe(config);
      expect(mockUomRepo.findBySku).toHaveBeenCalledTimes(1);
    });
  });
});
