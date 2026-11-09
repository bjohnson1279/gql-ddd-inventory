import {
  ConfigureProductUomUseCase,
  GetProductUomConfigurationUseCase,
  GetProductUomConfigurationByIdUseCase,
  AddUomConversionRuleUseCase,
  RemoveUomConversionRuleUseCase,
  SetUomUnitsUseCase,
  ConfigureUomInput
} from '../../../src/application/useCases/ManageUoms';
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
      findById: jest.fn(),
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

  describe('GetProductUomConfigurationByIdUseCase', () => {
    it('should return null if no config is found by ID', async () => {
      mockUomRepo.findById.mockResolvedValue(null);
      const useCase = new GetProductUomConfigurationByIdUseCase(mockUomRepo);

      const result = await useCase.execute('config-id-123');

      expect(result).toBeNull();
      expect(mockUomRepo.findById).toHaveBeenCalledWith('config-id-123');
    });

    it('should return the config if found by ID', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      mockUomRepo.findById.mockResolvedValue(config);
      const useCase = new GetProductUomConfigurationByIdUseCase(mockUomRepo);

      const result = await useCase.execute('config-id-123');

      expect(result).toBe(config);
      expect(mockUomRepo.findById).toHaveBeenCalledWith('config-id-123');
    });
  });

  describe('AddUomConversionRuleUseCase', () => {
    it('should throw an error if UOM configuration is not found', async () => {
      mockUomRepo.findBySku.mockResolvedValue(null);
      const useCase = new AddUomConversionRuleUseCase(mockUomRepo);

      await expect(
        useCase.execute({
          sku: 'SKU-UNKNOWN',
          unit: { name: 'Box', abbreviation: 'bx', category: UomCategory.Discrete },
          factorToBase: 10
        })
      ).rejects.toThrow("UOM configuration for SKU 'SKU-UNKNOWN' not found.");
      expect(mockUomRepo.save).not.toHaveBeenCalled();
    });

    it('should add a conversion rule and save configuration', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      mockUomRepo.findBySku.mockResolvedValue(config);
      const useCase = new AddUomConversionRuleUseCase(mockUomRepo);

      const result = await useCase.execute({
        sku: 'SKU-123',
        unit: { name: 'Box', abbreviation: 'bx', category: UomCategory.Discrete },
        factorToBase: 10,
        label: 'A Box of 10'
      });

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);
      expect(mockUomRepo.save).toHaveBeenCalledWith(config);
      expect(config.conversionRules).toHaveLength(1);
      expect(config.conversionRules[0].unit.name).toBe('Box');
      expect(config.conversionRules[0].factorToBase).toBe(10);
      expect(config.conversionRules[0].label).toBe('A Box of 10');
    });
  });

  describe('RemoveUomConversionRuleUseCase', () => {
    it('should throw an error if UOM configuration is not found', async () => {
      mockUomRepo.findBySku.mockResolvedValue(null);
      const useCase = new RemoveUomConversionRuleUseCase(mockUomRepo);

      await expect(
        useCase.execute({
          sku: 'SKU-UNKNOWN',
          unitName: 'Box'
        })
      ).rejects.toThrow("UOM configuration for SKU 'SKU-UNKNOWN' not found.");
      expect(mockUomRepo.save).not.toHaveBeenCalled();
    });

    it('should throw an error if conversion rule for unit name does not exist', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      mockUomRepo.findBySku.mockResolvedValue(config);
      const useCase = new RemoveUomConversionRuleUseCase(mockUomRepo);

      await expect(
        useCase.execute({
          sku: 'SKU-123',
          unitName: 'NonExistent'
        })
      ).rejects.toThrow("No conversion rule found for unit 'NonExistent'.");
      expect(mockUomRepo.save).not.toHaveBeenCalled();
    });

    it('should remove conversion rule and save configuration', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      const boxUnit = new UnitOfMeasure('Box', 'bx', UomCategory.Discrete);
      config.addConversionRule(boxUnit, 10);
      expect(config.conversionRules).toHaveLength(1);

      mockUomRepo.findBySku.mockResolvedValue(config);
      const useCase = new RemoveUomConversionRuleUseCase(mockUomRepo);

      const result = await useCase.execute({
        sku: 'SKU-123',
        unitName: 'Box'
      });

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);
      expect(mockUomRepo.save).toHaveBeenCalledWith(config);
      expect(config.conversionRules).toHaveLength(0);
    });
  });

  describe('SetUomUnitsUseCase', () => {
    it('should throw an error if UOM configuration is not found', async () => {
      mockUomRepo.findBySku.mockResolvedValue(null);
      const useCase = new SetUomUnitsUseCase(mockUomRepo);

      await expect(
        useCase.execute({
          sku: 'SKU-UNKNOWN',
          purchaseUnit: { name: 'Box', abbreviation: 'bx', category: UomCategory.Discrete }
        })
      ).rejects.toThrow("UOM configuration for SKU 'SKU-UNKNOWN' not found.");
      expect(mockUomRepo.save).not.toHaveBeenCalled();
    });

    it('should update purchaseUnit and saleUnit and save configuration', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      const boxUnit = new UnitOfMeasure('Box', 'bx', UomCategory.Discrete);
      const packUnit = new UnitOfMeasure('Pack', 'pk', UomCategory.Discrete);
      config.addConversionRule(boxUnit, 100);
      config.addConversionRule(packUnit, 10);

      mockUomRepo.findBySku.mockResolvedValue(config);
      const useCase = new SetUomUnitsUseCase(mockUomRepo);

      const result = await useCase.execute({
        sku: 'SKU-123',
        purchaseUnit: { name: 'Box', abbreviation: 'bx', category: UomCategory.Discrete },
        saleUnit: { name: 'Pack', abbreviation: 'pk', category: UomCategory.Discrete }
      });

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);
      expect(mockUomRepo.save).toHaveBeenCalledWith(config);
      expect(config.purchaseUnit.name).toBe('Box');
      expect(config.saleUnit.name).toBe('Pack');
    });

    it('should update only purchaseUnit when saleUnit is omitted', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      const boxUnit = new UnitOfMeasure('Box', 'bx', UomCategory.Discrete);
      config.addConversionRule(boxUnit, 100);

      mockUomRepo.findBySku.mockResolvedValue(config);
      const useCase = new SetUomUnitsUseCase(mockUomRepo);

      const result = await useCase.execute({
        sku: 'SKU-123',
        purchaseUnit: { name: 'Box', abbreviation: 'bx', category: UomCategory.Discrete }
      });

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);
      expect(config.purchaseUnit.name).toBe('Box');
      expect(config.saleUnit.name).toBe('Each');
    });

    it('should update only saleUnit when purchaseUnit is omitted', async () => {
      const config = new ProductUomConfiguration(
        new Sku('SKU-123'),
        new UnitOfMeasure('Each', 'ea', UomCategory.Discrete)
      );
      const packUnit = new UnitOfMeasure('Pack', 'pk', UomCategory.Discrete);
      config.addConversionRule(packUnit, 10);

      mockUomRepo.findBySku.mockResolvedValue(config);
      const useCase = new SetUomUnitsUseCase(mockUomRepo);

      const result = await useCase.execute({
        sku: 'SKU-123',
        saleUnit: { name: 'Pack', abbreviation: 'pk', category: UomCategory.Discrete }
      });

      expect(result).toBe(true);
      expect(mockUomRepo.save).toHaveBeenCalledTimes(1);
      expect(config.purchaseUnit.name).toBe('Each');
      expect(config.saleUnit.name).toBe('Pack');
    });
  });
});
