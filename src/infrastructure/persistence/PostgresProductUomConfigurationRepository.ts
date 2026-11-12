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

      // 2. Replace conversion rules in batch to eliminate N+1 queries
      // ⚡ Bolt: Replace per-rule upsert queries inside loop with a single deleteMany and batch createMany to eliminate N+1 queries
      await tx.conversionRule.deleteMany({
        where: {
          productUomSku: config.sku.value,
        },
      });

      if (config.conversionRules.length > 0) {
        const rulesData: Array<{
          id: string;
          productUomSku: string;
          unitName: string;
          unitAbbreviation: string;
          unitCategory: string;
          factorToBase: number;
          label: string | null;
        }> = [];

        for (const rule of config.conversionRules) {
          rulesData.push({
            id: rule.id.value,
            productUomSku: config.sku.value,
            unitName: rule.unit.name,
            unitAbbreviation: rule.unit.abbreviation,
            unitCategory: rule.unit.category,
            factorToBase: rule.factorToBase,
            label: rule.label || null,
          });
        }

        await tx.conversionRule.createMany({
          data: rulesData,
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

  async findById(id: string): Promise<ProductUomConfiguration | null> {
    // The UOM configuration's primary key IS the sku, so id === sku
    return this.findBySku(new Sku(id));
  }
}
