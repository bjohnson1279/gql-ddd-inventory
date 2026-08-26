import { IInventoryRepository } from '../repositories/IInventoryRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { IWarehouseLocationRepository } from '../repositories/IWarehouseLocationRepository';
import { LocationId } from '../valueObjects/LocationId';
import { Sku } from '../valueObjects/Sku';
import { CapacityExceededError } from '../exceptions/DomainErrors';

export interface WMSCapacityAdjustment {
  sku: string;
  mode: 'relative' | 'absolute';
  quantity: number;
}

export class WMSCapacityService {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly productRepository: IProductRepository,
    private readonly locationRepository: IWarehouseLocationRepository
  ) {}

  async validateCapacity(locationIdStr: string, adjustments: WMSCapacityAdjustment[]): Promise<void> {
    const locationId = new LocationId(locationIdStr);
    const location = await this.locationRepository.findById(locationId);
    
    // If the location does not exist in the WMS repository, it is treated as unconstrained
    if (!location) {
      return;
    }

    // Load current items in this location from repository
    const currentItems = await this.inventoryRepository.findByLocation(locationIdStr);

    // Build map of SKU to quantity
    const quantityMap = new Map<string, number>();
    for (const item of currentItems) {
      quantityMap.set(item.sku.value, item.quantity.value);
    }

    // Apply adjustments
    for (const adj of adjustments) {
      if (adj.mode === 'absolute') {
        quantityMap.set(adj.sku, adj.quantity);
      } else {
        const current = quantityMap.get(adj.sku) ?? 0;
        quantityMap.set(adj.sku, current + adj.quantity);
      }
    }

    // Calculate total weight and volume
    let totalWeight = 0;
    let totalVolume = 0;

    const activeSkus = Array.from(quantityMap.entries())
      .filter(([_, qty]) => qty > 0)
      .map(([skuStr]) => new Sku(skuStr));

    if (activeSkus.length === 0) {
      return;
    }

    const products = await this.productRepository.findBySkus(activeSkus);

    const variantMap = new Map<string, typeof products[number]['variants'][number]>();
    for (const product of products) {
      for (const variant of product.variants) {
        variantMap.set(variant.sku.value, variant);
      }
    }

    for (const [skuStr, qty] of quantityMap.entries()) {
      if (qty <= 0) {
        continue;
      }

      const variant = variantMap.get(skuStr);
      if (!variant) {
        continue;
      }

      totalWeight += qty * (variant.weightGrams ?? 0);
      totalVolume += qty * (variant.volumeCubicMeters ?? 0);
    }

    // Enforce constraints
    if (totalWeight > location.maxWeightGrams) {
      throw new CapacityExceededError(
        locationIdStr,
        'weight',
        location.maxWeightGrams,
        totalWeight
      );
    }

    if (totalVolume > location.maxVolumeCubicMeters) {
      throw new CapacityExceededError(
        locationIdStr,
        'volume',
        location.maxVolumeCubicMeters,
        totalVolume
      );
    }
  }
}
