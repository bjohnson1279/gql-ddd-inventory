import { PostgresProductUomConfigurationRepository } from '../../../src/infrastructure/persistence/PostgresProductUomConfigurationRepository';
import { ProductUomConfiguration } from '../../../src/domain/entities/ProductUomConfiguration';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/enums/UomCategory';

describe('PostgresProductUomConfigurationRepository', () => {
  let mockPrisma: any;
  let repository: PostgresProductUomConfigurationRepository;

  beforeEach(() => {
    mockPrisma = {
      productUomConfiguration: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      conversionRule: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };
    repository = new PostgresProductUomConfigurationRepository(mockPrisma);
  });

  describe('save', () => {
    it('should save configuration and batch insert conversion rules using createMany', async () => {
      const sku = new Sku('SKU-100');
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const boxUnit = new UnitOfMeasure('Box', 'bx', UomCategory.Discrete);
      const packUnit = new UnitOfMeasure('Pack', 'pk', UomCategory.Discrete);

      const config = new ProductUomConfiguration(sku, baseUnit);
      config.addConversionRule(boxUnit, 100, '1 Box = 100 Each');
      config.addConversionRule(packUnit, 10, '1 Pack = 10 Each');
      config.setPurchaseUnit(boxUnit);
      config.setSaleUnit(packUnit);

      await repository.save(config);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.productUomConfiguration.upsert).toHaveBeenCalledWith({
        where: { sku: 'SKU-100' },
        create: {
          sku: 'SKU-100',
          baseUnitName: 'Each',
          baseUnitAbbreviation: 'ea',
          baseUnitCategory: UomCategory.Discrete,
          purchaseUnitName: 'Box',
          purchaseUnitAbbreviation: 'bx',
          purchaseUnitCategory: UomCategory.Discrete,
          saleUnitName: 'Pack',
          saleUnitAbbreviation: 'pk',
          saleUnitCategory: UomCategory.Discrete,
        },
        update: {
          baseUnitName: 'Each',
          baseUnitAbbreviation: 'ea',
          baseUnitCategory: UomCategory.Discrete,
          purchaseUnitName: 'Box',
          purchaseUnitAbbreviation: 'bx',
          purchaseUnitCategory: UomCategory.Discrete,
          saleUnitName: 'Pack',
          saleUnitAbbreviation: 'pk',
          saleUnitCategory: UomCategory.Discrete,
        },
      });

      expect(mockPrisma.conversionRule.deleteMany).toHaveBeenCalledWith({
        where: {
          productUomSku: 'SKU-100',
        },
      });

      expect(mockPrisma.conversionRule.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            productUomSku: 'SKU-100',
            unitName: 'Box',
            unitAbbreviation: 'bx',
            unitCategory: UomCategory.Discrete,
            factorToBase: 100,
            label: '1 Box = 100 Each',
          }),
          expect.objectContaining({
            productUomSku: 'SKU-100',
            unitName: 'Pack',
            unitAbbreviation: 'pk',
            unitCategory: UomCategory.Discrete,
            factorToBase: 10,
            label: '1 Pack = 10 Each',
          }),
        ]),
      });

      // Crucial: ensure no looped individual upserts are triggered
      expect(mockPrisma.conversionRule.upsert).not.toHaveBeenCalled();
    });

    it('should save configuration without calling createMany when conversion rules are empty', async () => {
      const sku = new Sku('SKU-EMPTY');
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const config = new ProductUomConfiguration(sku, baseUnit);

      await repository.save(config);

      expect(mockPrisma.productUomConfiguration.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.conversionRule.deleteMany).toHaveBeenCalledWith({
        where: {
          productUomSku: 'SKU-EMPTY',
        },
      });
      expect(mockPrisma.conversionRule.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.conversionRule.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findBySku', () => {
    it('should return null when configuration does not exist', async () => {
      mockPrisma.productUomConfiguration.findUnique.mockResolvedValue(null);

      const result = await repository.findBySku(new Sku('SKU-MISSING'));

      expect(result).toBeNull();
      expect(mockPrisma.productUomConfiguration.findUnique).toHaveBeenCalledWith({
        where: { sku: 'SKU-MISSING' },
        include: { conversionRules: true },
      });
    });

    it('should reconstitute ProductUomConfiguration correctly when found', async () => {
      mockPrisma.productUomConfiguration.findUnique.mockResolvedValue({
        sku: 'SKU-100',
        baseUnitName: 'Gram',
        baseUnitAbbreviation: 'g',
        baseUnitCategory: UomCategory.Weight,
        purchaseUnitName: 'Kilogram',
        purchaseUnitAbbreviation: 'kg',
        purchaseUnitCategory: UomCategory.Weight,
        saleUnitName: 'Gram',
        saleUnitAbbreviation: 'g',
        saleUnitCategory: UomCategory.Weight,
        conversionRules: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            productUomSku: 'SKU-100',
            unitName: 'Kilogram',
            unitAbbreviation: 'kg',
            unitCategory: UomCategory.Weight,
            factorToBase: 1000,
            label: '1 kg = 1000 g',
          },
        ],
      });

      const result = await repository.findBySku(new Sku('SKU-100'));

      expect(result).not.toBeNull();
      expect(result?.sku.value).toBe('SKU-100');
      expect(result?.baseUnit.name).toBe('Gram');
      expect(result?.purchaseUnit.name).toBe('Kilogram');
      expect(result?.saleUnit.name).toBe('Gram');
      expect(result?.conversionRules).toHaveLength(1);
      expect(result?.conversionRules[0].unit.name).toBe('Kilogram');
      expect(result?.conversionRules[0].factorToBase).toBe(1000);
      expect(result?.conversionRules[0].label).toBe('1 kg = 1000 g');
    });
  });

  describe('findById', () => {
    it('should delegate to findBySku with Sku instance', async () => {
      mockPrisma.productUomConfiguration.findUnique.mockResolvedValue(null);

      const result = await repository.findById('SKU-BY-ID');

      expect(result).toBeNull();
      expect(mockPrisma.productUomConfiguration.findUnique).toHaveBeenCalledWith({
        where: { sku: 'SKU-BY-ID' },
        include: { conversionRules: true },
      });
    });
  });
});
