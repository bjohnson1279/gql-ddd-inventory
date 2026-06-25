import { PrismaClient } from '@prisma/client';
import { IDemandForecastRepository } from '../../domain/repositories/IDemandForecastRepository';
import { DemandForecast } from '../../domain/entities/DemandForecast';
import { DemandForecastId } from '../../domain/valueObjects/DemandForecastId';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresDemandForecastRepository implements IDemandForecastRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(forecast: DemandForecast): Promise<void> {
    const dbId = toUuid(forecast.id.value);

    await this.prisma.demandForecast.upsert({
      where: { id: dbId },
      create: {
        id: dbId,
        sku: forecast.sku.value,
        locationId: forecast.locationId.value,
        forecastedQuantity: forecast.forecastedQuantity,
        periodStart: forecast.periodStart,
        periodEnd: forecast.periodEnd,
        confidenceLevel: forecast.confidenceLevel,
        createdAt: forecast.createdAt,
        updatedAt: new Date(),
      },
      update: {
        forecastedQuantity: forecast.forecastedQuantity,
        periodStart: forecast.periodStart,
        periodEnd: forecast.periodEnd,
        confidenceLevel: forecast.confidenceLevel,
        updatedAt: new Date(),
      },
    });
  }

  async findForecast(sku: Sku, locationId: LocationId, periodStart: Date, periodEnd: Date): Promise<DemandForecast | null> {
    const result = await this.prisma.demandForecast.findFirst({
      where: {
        sku: sku.value,
        locationId: locationId.value,
        periodStart,
        periodEnd,
      },
    });

    if (!result) return null;

    return new DemandForecast(
      new DemandForecastId(result.id),
      new Sku(result.sku),
      new LocationId(result.locationId),
      result.forecastedQuantity,
      result.periodStart,
      result.periodEnd,
      result.confidenceLevel,
      result.createdAt
    );
  }

  async findAllForLocation(locationId: LocationId): Promise<DemandForecast[]> {
    const results = await this.prisma.demandForecast.findMany({
      where: {
        locationId: locationId.value,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return results.map(
      (result) =>
        new DemandForecast(
          new DemandForecastId(result.id),
          new Sku(result.sku),
          new LocationId(result.locationId),
          result.forecastedQuantity,
          result.periodStart,
          result.periodEnd,
          result.confidenceLevel,
          result.createdAt
        )
    );
  }
}
