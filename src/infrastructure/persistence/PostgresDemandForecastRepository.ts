import { PrismaClient } from '@prisma/client';
import { IDemandForecastRepository } from '../../domain/repositories/IDemandForecastRepository';
import { DemandForecast } from '../../domain/entities/DemandForecast';
import { DemandForecastId } from '../../domain/valueObjects/DemandForecastId';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class PostgresDemandForecastRepository implements IDemandForecastRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(forecast: DemandForecast): Promise<void> {
    await this.prisma.demandForecast.upsert({
      where: { id: forecast.id.value },
      create: {
        id: forecast.id.value,
        sku: forecast.sku.value,
        locationId: forecast.locationId.value,
        forecastedQuantity: forecast.forecastedQuantity,
        periodStart: forecast.periodStart,
        periodEnd: forecast.periodEnd,
        confidenceLevel: forecast.confidenceLevel,
        createdAt: forecast.createdAt
      },
      update: {
        forecastedQuantity: forecast.forecastedQuantity,
        periodStart: forecast.periodStart,
        periodEnd: forecast.periodEnd,
        confidenceLevel: forecast.confidenceLevel
      }
    });
  }

  async findAllForLocation(locationId: LocationId): Promise<DemandForecast[]> {
    const models = await this.prisma.demandForecast.findMany({
      where: { locationId: locationId.value }
    });

    return models.map(
      (m) =>
        new DemandForecast(
          new DemandForecastId(m.id),
          new Sku(m.sku),
          new LocationId(m.locationId),
          m.forecastedQuantity,
          m.periodStart,
          m.periodEnd,
          m.confidenceLevel,
          m.createdAt
        )
    );
  }
}
