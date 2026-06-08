import { ReplenishmentRuleId } from '../valueObjects/ReplenishmentRuleId';
import { TenantId } from '../valueObjects/TenantId';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';
import { ReplenishmentType } from '../enums/ReplenishmentType';

export class ReplenishmentRule {
  private _reorderPoint: number;
  private _reorderQuantity: number;
  private _safetyStock: number;
  private _leadTimeDays: number;
  private _isActive: boolean;
  private _dynamicRopEnabled: boolean;
  private _sourceLocationId: LocationId | null;
  private _supplierId: string | null;

  constructor(
    public readonly id: ReplenishmentRuleId,
    public readonly tenantId: TenantId,
    public readonly sku: Sku,
    public readonly locationId: LocationId,
    reorderPoint: number,
    reorderQuantity: number,
    safetyStock: number,
    leadTimeDays: number,
    public readonly replenishmentType: ReplenishmentType,
    sourceLocationId: LocationId | null = null,
    supplierId: string | null = null,
    isActive: boolean = true,
    dynamicRopEnabled: boolean = false,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    if (reorderPoint < 0) {
      throw new Error("Reorder point cannot be negative.");
    }
    if (reorderQuantity <= 0) {
      throw new Error("Reorder quantity must be positive.");
    }
    if (safetyStock < 0) {
      throw new Error("Safety stock cannot be negative.");
    }
    if (leadTimeDays < 0) {
      throw new Error("Lead time days cannot be negative.");
    }

    if (replenishmentType === ReplenishmentType.Transfer) {
      if (!sourceLocationId) {
        throw new Error("Source location is required for transfer replenishment.");
      }
      if (sourceLocationId.equals(locationId)) {
        throw new Error("Source location cannot be the same as the destination location.");
      }
    }

    if (replenishmentType === ReplenishmentType.Supplier && !supplierId) {
      throw new Error("Supplier ID is required for supplier replenishment.");
    }

    this._reorderPoint = reorderPoint;
    this._reorderQuantity = reorderQuantity;
    this._safetyStock = safetyStock;
    this._leadTimeDays = leadTimeDays;
    this._sourceLocationId = sourceLocationId;
    this._supplierId = supplierId;
    this._isActive = isActive;
    this._dynamicRopEnabled = dynamicRopEnabled;
  }

  get reorderPoint(): number { return this._reorderPoint; }
  get reorderQuantity(): number { return this._reorderQuantity; }
  get safetyStock(): number { return this._safetyStock; }
  get leadTimeDays(): number { return this._leadTimeDays; }
  get sourceLocationId(): LocationId | null { return this._sourceLocationId; }
  get supplierId(): string | null { return this._supplierId; }
  get isActive(): boolean { return this._isActive; }
  get dynamicRopEnabled(): boolean { return this._dynamicRopEnabled; }

  updateReorderPoint(newRop: number): void {
    if (newRop < 0) {
      throw new Error("Reorder point cannot be negative.");
    }
    this._reorderPoint = newRop;
  }

  toggleActive(isActive: boolean): void {
    this._isActive = isActive;
  }

  updateConfiguration(
    reorderQuantity: number,
    safetyStock: number,
    leadTimeDays: number,
    dynamicRopEnabled: boolean,
    reorderPoint?: number
  ): void {
    if (reorderQuantity <= 0) {
      throw new Error("Reorder quantity must be positive.");
    }
    if (safetyStock < 0) {
      throw new Error("Safety stock cannot be negative.");
    }
    if (leadTimeDays < 0) {
      throw new Error("Lead time days cannot be negative.");
    }

    this._reorderQuantity = reorderQuantity;
    this._safetyStock = safetyStock;
    this._leadTimeDays = leadTimeDays;
    this._dynamicRopEnabled = dynamicRopEnabled;

    if (reorderPoint !== undefined) {
      this.updateReorderPoint(reorderPoint);
    }
  }

  static createNew(
    id: ReplenishmentRuleId,
    tenantId: TenantId,
    sku: Sku,
    locationId: LocationId,
    reorderPoint: number,
    reorderQuantity: number,
    safetyStock: number,
    leadTimeDays: number,
    replenishmentType: ReplenishmentType,
    sourceLocationId: LocationId | null = null,
    supplierId: string | null = null,
    dynamicRopEnabled: boolean = false
  ): ReplenishmentRule {
    return new ReplenishmentRule(
      id,
      tenantId,
      sku,
      locationId,
      reorderPoint,
      reorderQuantity,
      safetyStock,
      leadTimeDays,
      replenishmentType,
      sourceLocationId,
      supplierId,
      true,
      dynamicRopEnabled
    );
  }

  static reconstruct(
    id: ReplenishmentRuleId,
    tenantId: TenantId,
    sku: Sku,
    locationId: LocationId,
    reorderPoint: number,
    reorderQuantity: number,
    safetyStock: number,
    leadTimeDays: number,
    replenishmentType: ReplenishmentType,
    sourceLocationId: LocationId | null,
    supplierId: string | null,
    isActive: boolean,
    dynamicRopEnabled: boolean,
    createdAt: Date,
    updatedAt: Date
  ): ReplenishmentRule {
    return new ReplenishmentRule(
      id,
      tenantId,
      sku,
      locationId,
      reorderPoint,
      reorderQuantity,
      safetyStock,
      leadTimeDays,
      replenishmentType,
      sourceLocationId,
      supplierId,
      isActive,
      dynamicRopEnabled,
      createdAt,
      updatedAt
    );
  }
}
