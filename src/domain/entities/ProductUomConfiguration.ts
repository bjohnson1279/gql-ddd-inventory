import { Sku } from '../valueObjects/Sku';
import { UnitOfMeasure } from '../valueObjects/UnitOfMeasure';
import { ConversionRule } from './ConversionRule';
import { ConversionRuleId } from '../valueObjects/ConversionRuleId';
import { UomCategory } from '../enums/UomCategory';
import { StandardUnits } from '../services/StandardUnits';

export class ProductUomConfiguration {
  private _conversionRules: ConversionRule[] = [];
  private _purchaseUnit?: UnitOfMeasure;
  private _saleUnit?: UnitOfMeasure;

  constructor(
    public readonly sku: Sku,
    public readonly baseUnit: UnitOfMeasure
  ) {}

  addConversionRule(unit: UnitOfMeasure, factorToBase: number, label?: string): void {
    if (!unit.isCompatibleWith(this.baseUnit)) {
      throw new Error(`Unit ${unit.name} is not compatible with base unit ${this.baseUnit.name}.`);
    }

    if (unit.equals(this.baseUnit)) {
      throw new Error('Cannot add a conversion rule for the base unit itself.');
    }

    const existing = this._conversionRules.find(r => r.unit.equals(unit));
    if (existing) {
      throw new Error(`A conversion rule for ${unit.name} already exists.`);
    }

    this._conversionRules.push(new ConversionRule(
      new ConversionRuleId(this.generateId()),
      unit,
      factorToBase,
      label
    ));
  }

  removeConversionRule(unit: UnitOfMeasure): void {
    this._conversionRules = this._conversionRules.filter(r => !r.unit.equals(unit));
  }

  setPurchaseUnit(unit: UnitOfMeasure): void {
    this.assertUnitIsKnown(unit);
    this._purchaseUnit = unit;
  }

  setSaleUnit(unit: UnitOfMeasure): void {
    this.assertUnitIsKnown(unit);
    this._saleUnit = unit;
  }

  get purchaseUnit(): UnitOfMeasure {
    return this._purchaseUnit ?? this.baseUnit;
  }

  get saleUnit(): UnitOfMeasure {
    return this._saleUnit ?? this.baseUnit;
  }

  get conversionRules(): ConversionRule[] {
    return [...this._conversionRules];
  }

  factorToBase(unit: UnitOfMeasure): number {
    if (unit.equals(this.baseUnit)) {
      return 1.0;
    }

    if (unit.category === UomCategory.Weight) {
      const unitFactor = StandardUnits.weightFactorToGrams(unit);
      const baseFactor = StandardUnits.weightFactorToGrams(this.baseUnit);
      return unitFactor / baseFactor;
    }

    if (unit.category === UomCategory.Volume) {
      const unitFactor = StandardUnits.volumeFactorToMilliliters(unit);
      const baseFactor = StandardUnits.volumeFactorToMilliliters(this.baseUnit);
      return unitFactor / baseFactor;
    }

    const rule = this._conversionRules.find(r => r.unit.equals(unit));
    if (rule) {
      return rule.factorToBase;
    }

    throw new Error(`No conversion rule found for ${unit.name} -> ${this.baseUnit.name}.`);
  }

  private assertUnitIsKnown(unit: UnitOfMeasure): void {
    if (unit.equals(this.baseUnit)) {
      return;
    }

    if (this._conversionRules.some(r => r.unit.equals(unit))) {
      return;
    }

    throw new Error(`Unit ${unit.name} has no conversion rule defined.`);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
