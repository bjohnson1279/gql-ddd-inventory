import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { ReasonCode } from '../enums/ReasonCode';

export class DemandVelocityCalculator {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository
  ) {}

  async calculateAverageDailySales(
    sku: Sku,
    locationId: LocationId,
    windowDays: number = 30
  ): Promise<number> {
    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      return 0;
    }

    const variant = product.findVariantBySku(sku);
    if (!variant) {
      return 0;
    }

    const entries = await this.ledgerRepo.entriesFor(variant.id, locationId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);

    const salesEntries = entries.filter((e) => {
      return (
        e.occurredAt >= startDate &&
        e.quantity < 0 &&
        (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale)
      );
    });

    const totalQuantity = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0);
    return totalQuantity / windowDays;
  }
}

export class ReorderPointForecaster {
  constructor(private readonly velocityCalculator: DemandVelocityCalculator) {}

  async forecastReorderPoint(
    sku: Sku,
    locationId: LocationId,
    leadTimeDays: number,
    safetyStock: number,
    windowDays: number = 30
  ): Promise<number> {
    const dailyRunrate = await this.velocityCalculator.calculateAverageDailySales(sku, locationId, windowDays);
    const calculatedRop = dailyRunrate * leadTimeDays + safetyStock;
    return Math.ceil(calculatedRop);
  }
}
