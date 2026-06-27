import { DemandForecast } from '../entities/DemandForecast';
import { LocationId } from '../valueObjects/LocationId';

export interface IDemandForecastRepository {
  save(forecast: DemandForecast): Promise<void>;
  findAllForLocation(locationId: LocationId): Promise<DemandForecast[]>;
}
