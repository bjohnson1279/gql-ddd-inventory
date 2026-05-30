import { PrismaClient } from '@prisma/client';
import { IProductUomConfigurationRepository } from '../../domain/repositories/IProductUomConfigurationRepository';
import { ProductUomConfiguration } from '../../domain/entities/ProductUomConfiguration';
import { ConversionRule } from '../../domain/entities/ConversionRule';
import { ConversionRuleId } from '../../domain/valueObjects/ConversionRuleId';
import { Sku } from '../../domain/valueObjects/Sku';
import { UnitOfMeasure } from '../../domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../domain/enums/UomCategory';

export class PostgresProductUomConfigurationRepository implements IProductUomConfigurationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(config: ProductUomConfiguration): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert configuration
      await tx.productUomConfiguration.upsert({
        where: { sku: config.sku.value },
        create: {
          sku: config.sku.value,
          baseUnitName: config.baseUnit.name,
          baseUnitAbbreviation: config.baseUnit.abbreviation,
          baseUnitCategory: config.baseUnit.category,
          purchaseUnitName: config.purchaseUnit?.name || null,
          purchaseUnitAbbreviation: config.purchaseUnit?.abbreviation || null,
          purchaseUnitCategory: config.purchaseUnit?.category || null,
          saleUnitName: config.saleUnit?.name || null,
          saleUnitAbbreviation: config.saleUnit?.abbreviation || null,
          saleUnitCategory: config.saleUnit?.category || null,
        },
        update: {
          baseUnitName: config.baseUnit.name,
          baseUnitAbbreviation: config.baseUnit.abbreviation,
          baseUnitCategory: config.baseUnit.category,
          purchaseUnitName: config.purchaseUnit?.name || null,
          purchaseUnitAbbreviation: config.purchaseUnit?.abbreviation || null,
          purchaseUnitCategory: config.purchaseUnit?.category || null,
          saleUnitName: config.saleUnit?.name || null,
          saleUnitAbbreviation: config.saleUnit?.abbreviation || null,
          saleUnitCategory: config.saleUnit?.category || null,
        },
      });

      // 2. Identify conversion rules to keep
      const ruleIds = config.conversionRules.map((r) => r.id.value);

      // Delete removed rules
      await tx.conversionRule.deleteMany({
        where: {
          productUomSku: config.sku.value,
          id: { notIn: ruleIds },
        },
      });

      // Upsert present rules
      for (const rule of config.conversionRules) {
        await tx.conversionRule.upsert({
          where: { id: rule.id.value },
          create: {
            id: rule.id.value,
            productUomSku: config.sku.value,
            unitName: rule.unit.name,
            unitAbbreviation: rule.unit.abbreviation,
            unitCategory: rule.unit.category,
            factorToBase: rule.factorToBase,
            label: rule.label || null,
          },
          update: {
            unitName: rule.unit.name,
            unitAbbreviation: rule.unit.abbreviation,
            unitCategory: rule.unit.category,
            factorToBase: rule.factorToBase,
            label: rule.label || null,
          },
        });
      }
    });
  }

  async findBySku(sku: Sku): Promise<ProductUomConfiguration | null> {
    const model = await this.prisma.productUomConfiguration.findUnique({
      where: { sku: sku.value },
      include: {
        conversionRules: true,
      },
    });

    if (!model) return null;

    const baseUnit = new UnitOfMeasure(
      model.baseUnitName,
      model.baseUnitAbbreviation,
      model.baseUnitCategory as UomCategory
    );

    const config = new ProductUomConfiguration(sku, baseUnit);

    // Reconstitute purchase and sale units
    if (model.purchaseUnitName) {
      (config as any)._purchaseUnit = new UnitOfMeasure(
        model.purchaseUnitName,
        model.purchaseUnitAbbreviation!,
        model.purchaseUnitCategory! as UomCategory
      );
    }
    if (model.saleUnitName) {
      (config as any)._saleUnit = new UnitOfMeasure(
        model.saleUnitName,
        model.saleUnitAbbreviation!,
        model.saleUnitCategory! as UomCategory
      );
    }

    // Reconstitute conversion rules
    const rules = model.conversionRules.map(
      (r) =>
        new ConversionRule(
          new ConversionRuleId(r.id),
          new UnitOfMeasure(r.unitName, r.unitAbbreviation, r.unitCategory as UomCategory),
          r.factorToBase,
          r.label || undefined
        )
    );

    (config as any)._conversionRules = rules;

    return config;
  }
}
