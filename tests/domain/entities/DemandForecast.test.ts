import { DemandForecast } from '../../../src/domain/entities/DemandForecast';
import { DemandForecastId } from '../../../src/domain/valueObjects/DemandForecastId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('DemandForecast', () => {
  const id = new DemandForecastId('df-123');
  const sku = new Sku('SKU-123');
  const locationId = new LocationId('loc-1');
  const periodStart = new Date('2024-01-01T00:00:00Z');
  const periodEnd = new Date('2024-01-31T23:59:59Z');

  it('should initialize with valid values', () => {
    const forecast = new DemandForecast(
      id,
      sku,
      locationId,
      100,
      periodStart,
      periodEnd,
      0.8
    );
    expect(forecast.id).toBe(id);
    expect(forecast.sku).toBe(sku);
    expect(forecast.locationId).toBe(locationId);
    expect(forecast.forecastedQuantity).toBe(100);
    expect(forecast.periodStart).toBe(periodStart);
    expect(forecast.periodEnd).toBe(periodEnd);
    expect(forecast.confidenceLevel).toBe(0.8);
    expect(forecast.createdAt).toBeInstanceOf(Date);
  });

  it('should throw error if forecasted quantity is negative', () => {
    expect(() => {
      new DemandForecast(id, sku, locationId, -1, periodStart, periodEnd, 0.8);
    }).toThrow('Forecasted quantity cannot be negative.');
  });

  it('should throw error if confidence level is negative', () => {
    expect(() => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodEnd, -0.1);
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw error if confidence level is greater than 1', () => {
    expect(() => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodEnd, 1.1);
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw error if period start is after or equal to period end', () => {
    expect(() => {
      new DemandForecast(id, sku, locationId, 100, periodEnd, periodStart, 0.8);
    }).toThrow('Period start must be before period end.');

    expect(() => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodStart, 0.8);
    }).toThrow('Period start must be before period end.');
  });
});
