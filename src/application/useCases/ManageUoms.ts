import { IProductUomConfigurationRepository } from '../../domain/repositories/IProductUomConfigurationRepository';
import { ProductUomConfiguration } from '../../domain/entities/ProductUomConfiguration';
import { UnitOfMeasure } from '../../domain/valueObjects/UnitOfMeasure';
import { Sku } from '../../domain/valueObjects/Sku';
import { UomCategory } from '../../domain/enums/UomCategory';

export interface UnitInput {
  name: string;
  abbreviation: string;
  category: UomCategory;
}

export interface ConfigureUomInput {
  sku: string;
  baseUnit: UnitInput;
  purchaseUnit?: UnitInput;
  saleUnit?: UnitInput;
  conversionRules: {
    unit: UnitInput;
    factorToBase: number;
    label?: string;
  }[];
}

export class ConfigureProductUomUseCase {
  constructor(private readonly uomRepo: IProductUomConfigurationRepository) {}

  async execute(input: ConfigureUomInput): Promise<boolean> {
    const sku = new Sku(input.sku);
    const base = new UnitOfMeasure(input.baseUnit.name, input.baseUnit.abbreviation, input.baseUnit.category);
    const config = new ProductUomConfiguration(sku, base);

    // Add conversion rules
    for (const rule of input.conversionRules) {
      config.addConversionRule(
        new UnitOfMeasure(rule.unit.name, rule.unit.abbreviation, rule.unit.category),
        rule.factorToBase,
        rule.label
      );
    }

    // Set purchase/sale units if specified
    if (input.purchaseUnit) {
      config.setPurchaseUnit(
        new UnitOfMeasure(input.purchaseUnit.name, input.purchaseUnit.abbreviation, input.purchaseUnit.category)
      );
    }
    if (input.saleUnit) {
      config.setSaleUnit(
        new UnitOfMeasure(input.saleUnit.name, input.saleUnit.abbreviation, input.saleUnit.category)
      );
    }

    await this.uomRepo.save(config);
    return true;
  }
}

export class GetProductUomConfigurationUseCase {
  constructor(private readonly uomRepo: IProductUomConfigurationRepository) {}

  async execute(sku: string): Promise<ProductUomConfiguration | null> {
    return await this.uomRepo.findBySku(new Sku(sku));
  }
}

export class GetProductUomConfigurationByIdUseCase {
  constructor(private readonly uomRepo: IProductUomConfigurationRepository) {}

  async execute(id: string): Promise<ProductUomConfiguration | null> {
    return await this.uomRepo.findById(id);
  }
}

export class AddUomConversionRuleUseCase {
  constructor(private readonly uomRepo: IProductUomConfigurationRepository) {}

  async execute(input: { sku: string; unit: UnitInput; factorToBase: number; label?: string }): Promise<boolean> {
    const config = await this.uomRepo.findBySku(new Sku(input.sku));
    if (!config) {
      throw new Error(`UOM configuration for SKU '${input.sku}' not found.`);
    }

    config.addConversionRule(
      new UnitOfMeasure(input.unit.name, input.unit.abbreviation, input.unit.category),
      input.factorToBase,
      input.label
    );

    await this.uomRepo.save(config);
    return true;
  }
}

export class RemoveUomConversionRuleUseCase {
  constructor(private readonly uomRepo: IProductUomConfigurationRepository) {}

  async execute(input: { sku: string; unitName: string }): Promise<boolean> {
    const config = await this.uomRepo.findBySku(new Sku(input.sku));
    if (!config) {
      throw new Error(`UOM configuration for SKU '${input.sku}' not found.`);
    }

    // Find the unit by name among existing rules
    const existingRule = (config.conversionRules as any[]).find((r: any) => r.unit.name === input.unitName);
    if (!existingRule) {
      throw new Error(`No conversion rule found for unit '${input.unitName}'.`);
    }

    config.removeConversionRule(existingRule.unit);
    await this.uomRepo.save(config);
    return true;
  }
}

export class SetUomUnitsUseCase {
  constructor(private readonly uomRepo: IProductUomConfigurationRepository) {}

  async execute(input: { sku: string; purchaseUnit?: UnitInput; saleUnit?: UnitInput }): Promise<boolean> {
    const config = await this.uomRepo.findBySku(new Sku(input.sku));
    if (!config) {
      throw new Error(`UOM configuration for SKU '${input.sku}' not found.`);
    }

    if (input.purchaseUnit) {
      config.setPurchaseUnit(
        new UnitOfMeasure(input.purchaseUnit.name, input.purchaseUnit.abbreviation, input.purchaseUnit.category)
      );
    }

    if (input.saleUnit) {
      config.setSaleUnit(
        new UnitOfMeasure(input.saleUnit.name, input.saleUnit.abbreviation, input.saleUnit.category)
      );
    }

    await this.uomRepo.save(config);
    return true;
  }
}
