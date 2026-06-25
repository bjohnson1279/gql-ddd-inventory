import { IDemandForecastRepository } from '../../domain/repositories/IDemandForecastRepository';
import { DemandForecast } from '../../domain/entities/DemandForecast';
import { DemandForecastId } from '../../domain/valueObjects/DemandForecastId';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class InMemoryDemandForecastRepository implements IDemandForecastRepository {
  private readonly forecasts: Map<string, DemandForecast> = new Map();

  async save(forecast: DemandForecast): Promise<void> {
    this.forecasts.set(forecast.id.value, this.clone(forecast));
  }

  async findForecast(sku: Sku, locationId: LocationId, periodStart: Date, periodEnd: Date): Promise<DemandForecast | null> {
    for (const f of this.forecasts.values()) {
      if (
        f.sku.equals(sku) &&
        f.locationId.equals(locationId) &&
        f.periodStart.getTime() === periodStart.getTime() &&
        f.periodEnd.getTime() === periodEnd.getTime()
      ) {
        return this.clone(f);
      }
    }
    return null;
  }

  async findAllForLocation(locationId: LocationId): Promise<DemandForecast[]> {
    const results: DemandForecast[] = [];
    for (const f of this.forecasts.values()) {
      if (f.locationId.equals(locationId)) {
        results.push(this.clone(f));
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private clone(forecast: DemandForecast): DemandForecast {
    return new DemandForecast(
      new DemandForecastId(forecast.id.value),
      new Sku(forecast.sku.value),
      new LocationId(forecast.locationId.value),
      forecast.forecastedQuantity,
      new Date(forecast.periodStart.getTime()),
      new Date(forecast.periodEnd.getTime()),
      forecast.confidenceLevel,
      new Date(forecast.createdAt.getTime())
    );
  }
}
