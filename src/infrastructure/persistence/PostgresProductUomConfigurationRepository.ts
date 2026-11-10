import { PrismaClient, Prisma } from '@prisma/client';
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

      // ⚡ Bolt: Replace N+1 individual upserts inside transaction with a raw SQL batch upsert to eliminate N database roundtrips
      if (config.conversionRules.length > 0) {
        const insertRows = config.conversionRules.map(
          (rule) =>
            Prisma.sql`(${rule.id.value}::uuid, ${config.sku.value}::text, ${rule.unit.name}::text, ${rule.unit.abbreviation}::text, ${rule.unit.category}::text, ${rule.factorToBase}::float8, ${rule.label || null}::text)`
        );

        await tx.$executeRaw`
          INSERT INTO conversion_rules (id, product_uom_sku, unit_name, unit_abbreviation, unit_category, factor_to_base, label)
          VALUES ${Prisma.join(insertRows)}
          ON CONFLICT (id) DO UPDATE SET
            product_uom_sku = EXCLUDED.product_uom_sku,
            unit_name = EXCLUDED.unit_name,
            unit_abbreviation = EXCLUDED.unit_abbreviation,
            unit_category = EXCLUDED.unit_category,
            factor_to_base = EXCLUDED.factor_to_base,
            label = EXCLUDED.label;
        `;
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
