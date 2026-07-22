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
  const validLocationId = new LocationId('LOC-1');
  const validStartDate = new Date('2023-10-01T00:00:00Z');
  const validEndDate = new Date('2023-10-31T23:59:59Z');
  const validConfidenceLevel = 0.85;

  it('should successfully create a DemandForecast when all inputs are valid', () => {
    const forecast = new DemandForecast(
      validId,
      validSku,
      validLocationId,
      validQuantity,
      validStart,
      validEnd,
      validConfidence
      validStartDate,
      validEndDate,
      validConfidenceLevel
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
    expect(forecast.periodStart).toBe(validStartDate);
    expect(forecast.periodEnd).toBe(validEndDate);
    expect(forecast.confidenceLevel).toBe(validConfidenceLevel);

  it('should throw an error if forecastedQuantity is negative', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        -10,
        validStart,
        validEnd,
        validConfidence
        -10, // Invalid: negative quantity
        validStartDate,
        validEndDate,
        validConfidenceLevel
      );
    }).toThrow('Forecasted quantity cannot be negative.');
  });

  it('should throw an error if confidence level is less than 0', () => {
  it('should throw an error if confidenceLevel is less than 0', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validStart,
        validEnd,
        -0.1
        validStartDate,
        validEndDate,
        -0.1 // Invalid: confidence level < 0
      );
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw an error if confidence level is greater than 1', () => {
  it('should throw an error if confidenceLevel is greater than 1', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validStart,
        validEnd,
        1.1
        validStartDate,
        validEndDate,
        1.1 // Invalid: confidence level > 1
      );
    }).toThrow('Confidence level must be between 0 and 1.');
  });

  it('should throw an error if period start is after period end', () => {
  it('should throw an error if periodStart is after periodEnd', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validEnd, // swapped
        validStart, // swapped
        validConfidence
        new Date('2023-10-31T23:59:59Z'), // Start is after end
        new Date('2023-10-01T00:00:00Z'),
        validConfidenceLevel
      );
    }).toThrow('Period start must be before period end.');
  });

  it('should throw an error if period start is equal to period end', () => {
  it('should throw an error if periodStart is equal to periodEnd', () => {
    const sameDate = new Date('2023-10-15T12:00:00Z');
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        validQuantity,
        validStart,
        validStart, // equal
        validConfidence
        sameDate, // Start is equal to end
        sameDate,
        validConfidenceLevel
      );
    }).toThrow('Period start must be before period end.');
  });
});
