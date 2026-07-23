import { DemandForecast } from '../../../src/domain/entities/DemandForecast';
import { DemandForecastId } from '../../../src/domain/valueObjects/DemandForecastId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('DemandForecast', () => {
  const validId = new DemandForecastId('df-123');
  const validSku = new Sku('SKU-123');
  const validLocationId = new LocationId('loc-456');
  const validQuantity = 100;
  const validPeriodStart = new Date('2024-01-01T00:00:00Z');
  const validPeriodEnd = new Date('2024-02-01T00:00:00Z');
  const validConfidenceLevel = 0.9;

  it('should create a DemandForecast instance successfully when valid parameters are provided', () => {
    const forecast = new DemandForecast(
      validId,
      validSku,
      validLocationId,
      validQuantity,
      validPeriodStart,
      validPeriodEnd,
      validConfidenceLevel
    );

    expect(forecast.id).toBe(validId);
    expect(forecast.sku).toBe(validSku);
    expect(forecast.locationId).toBe(validLocationId);
    expect(forecast.forecastedQuantity).toBe(validQuantity);
    expect(forecast.periodStart).toBe(validPeriodStart);
    expect(forecast.periodEnd).toBe(validPeriodEnd);
    expect(forecast.confidenceLevel).toBe(validConfidenceLevel);
    expect(forecast.createdAt).toBeInstanceOf(Date);
  });

  it('should throw an error when forecastedQuantity is less than 0', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        -10, // Invalid quantity
        validPeriodStart,
        validPeriodEnd,
        validConfidenceLevel
      );
    }).toThrow('Forecasted quantity cannot be negative.');
  });

  it('should throw an error when confidenceLevel is less than 0', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validPeriodStart,
        validPeriodEnd,
        -0.1 // Invalid confidence level
      );
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw an error when confidenceLevel is greater than 1', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validPeriodStart,
        validPeriodEnd,
        1.5 // Invalid confidence level
      );
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw an error when periodStart is equal to periodEnd', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validPeriodStart,
        validPeriodStart, // Start equals End
        validConfidenceLevel
      );
    }).toThrow('Period start must be before period end.');
  });

  it('should throw an error when periodStart is after periodEnd', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validPeriodEnd, // Start is after End
        validPeriodStart,
        validConfidenceLevel
      );
    }).toThrow('Period start must be before period end.');
  });
});
