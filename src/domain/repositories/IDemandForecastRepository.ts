import { DemandForecast } from '../entities/DemandForecast';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';

export interface IDemandForecastRepository {
  save(forecast: DemandForecast): Promise<void>;
  findForecast(sku: Sku, locationId: LocationId, periodStart: Date, periodEnd: Date): Promise<DemandForecast | null>;
  findAllForLocation(locationId: LocationId): Promise<DemandForecast[]>;
}
