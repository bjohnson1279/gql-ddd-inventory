import { DemandForecast } from '../../../src/domain/entities/DemandForecast';
import { DemandForecastId } from '../../../src/domain/valueObjects/DemandForecastId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('DemandForecast', () => {
  const validId = new DemandForecastId('df-123');
  const validSku = new Sku('SKU-123');
  const validLocationId = new LocationId('loc-1');
  const validQuantity = 100;
  const validStart = new Date('2023-01-01');
  const validEnd = new Date('2023-01-31');
  const validConfidence = 0.8;

  it('should initialize successfully with valid parameters', () => {
    const forecast = new DemandForecast(
      validId,
      validSku,
      validLocationId,
      validQuantity,
      validStart,
      validEnd,
      validConfidence
    );

    expect(forecast.id).toBe(validId);
    expect(forecast.sku).toBe(validSku);
    expect(forecast.locationId).toBe(validLocationId);
    expect(forecast.forecastedQuantity).toBe(validQuantity);
    expect(forecast.periodStart).toBe(validStart);
    expect(forecast.periodEnd).toBe(validEnd);
    expect(forecast.confidenceLevel).toBe(validConfidence);
    expect(forecast.createdAt).toBeInstanceOf(Date);
  });

  it('should throw an error if forecasted quantity is negative', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        -10,
        validStart,
        validEnd,
        validConfidence
      );
    }).toThrow('Forecasted quantity cannot be negative.');
  });

  it('should throw an error if confidence level is less than 0', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validStart,
        validEnd,
        -0.1
      );
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw an error if confidence level is greater than 1', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validStart,
        validEnd,
        1.1
      );
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw an error if period start is after period end', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validEnd, // swapped
        validStart, // swapped
        validConfidence
      );
    }).toThrow('Period start must be before period end.');
  });

  it('should throw an error if period start is equal to period end', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validStart,
        validStart, // equal
        validConfidence
      );
    }).toThrow('Period start must be before period end.');
  });
});
