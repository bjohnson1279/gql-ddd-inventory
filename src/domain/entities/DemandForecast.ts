import { DemandForecastId } from '../valueObjects/DemandForecastId';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';

export class DemandForecast {
  constructor(
    public readonly id: DemandForecastId,
    public readonly sku: Sku,
    public readonly locationId: LocationId,
    public readonly forecastedQuantity: number,
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
    public readonly confidenceLevel: number,
    public readonly createdAt: Date
  ) {
    if (forecastedQuantity < 0) {
      throw new Error("Forecasted quantity cannot be negative.");
    }
    if (confidenceLevel < 0 || confidenceLevel > 1) {
      throw new Error("Confidence level must be between 0.0 and 1.0.");
    }
    if (periodStart >= periodEnd) {
      throw new Error("Period start must be before period end.");
    }
  }
}
