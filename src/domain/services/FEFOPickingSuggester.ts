import { IInventoryCostLayerRepository } from '../repositories/IInventoryCostLayerRepository';
import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { Sku } from '../valueObjects/Sku';
import { ProductVariantId } from '../valueObjects/ProductVariantId';

export interface FefoPickSuggestion {
  locationId: string;
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
}

export class FEFOPickingSuggester {
  constructor(
    private readonly costLayers: IInventoryCostLayerRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly productRepo: IProductRepository
  ) {}

  async suggestFefoPicking(sku: Sku, quantity: number): Promise<FefoPickSuggestion[]> {
    if (quantity <= 0) {
      throw new Error("Pick quantity must be positive.");
    }

    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      throw new Error(`Product variant with SKU ${sku.value} not found.`);
    }

    const variant = product.variants.find(v => v.sku.equals(sku));
    if (!variant) {
      throw new Error(`Product variant with SKU ${sku.value} not found.`);
    }

    const variantId = variant.id;

    // 1. Get active cost layers sorted by expiration date ascending (FEFO)
    const activeLayers = await this.costLayers.getActiveLayers(variantId, 'expiration_date ASC');
    const lotLayers = activeLayers.filter(l => l.lot !== undefined);

    if (lotLayers.length === 0) {
      throw new Error(`No lot-controlled inventory layers found for SKU ${sku.value}.`);
    }

    // 2. Fetch all ledger entries for this variant to compute physical location-lot balances
    const ledgerEntries = await this.ledgerRepo.entriesFor(variantId);
    
    // Group ledger entries to find net quantity per location per lot number
    // Map: lotNumber -> Map: locationId -> netQuantity
    const lotBalances = new Map<string, Map<string, number>>();

    for (const entry of ledgerEntries) {
      const lotNo = entry.metadata?.lotNumber;
      if (!lotNo) continue;

      const locId = entry.locationId.value;
      const balancesForLot = lotBalances.get(lotNo) ?? new Map<string, number>();
      const current = balancesForLot.get(locId) ?? 0;
      balancesForLot.set(locId, current + entry.quantity);
      lotBalances.set(lotNo, balancesForLot);
    }

    // 3. Fulfill pick quantity using earliest expiring lots first
    const suggestions: FefoPickSuggestion[] = [];
    let remainingToPick = quantity;

    for (const layer of lotLayers) {
      if (remainingToPick <= 0) break;

      const lot = layer.lot!;
      const balancesForLot = lotBalances.get(lot.lotNumber);
      if (!balancesForLot) continue;

      // Iterate through locations holding this lot and allocate quantity
      for (const [locationId, locationQty] of balancesForLot.entries()) {
        if (locationQty <= 0) continue;
        if (remainingToPick <= 0) break;

        const allocatedFromLocation = Math.min(remainingToPick, locationQty);
        
        // Deduct from temporary balance tracking
        balancesForLot.set(locationId, locationQty - allocatedFromLocation);
        remainingToPick -= allocatedFromLocation;

        suggestions.push({
          locationId,
          lotNumber: lot.lotNumber,
          expirationDate: lot.expirationDate,
          quantity: allocatedFromLocation
        });
      }
    }

    if (remainingToPick > 0) {
      throw new Error(`Insufficient lot-controlled inventory available to pick ${quantity} units for SKU ${sku.value} (Missing: ${remainingToPick}).`);
    }

    return suggestions;
  }
}
