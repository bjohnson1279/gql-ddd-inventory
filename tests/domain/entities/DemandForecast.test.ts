import { DemandForecast } from '../../../src/domain/entities/DemandForecast';
import { DemandForecastId } from '../../../src/domain/valueObjects/DemandForecastId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('DemandForecast', () => {
  const validId = new DemandForecastId('df-123');
  const validSku = new Sku('SKU-123');
  const validLocationId = new LocationId('LOC-1');
  const validQuantity = 100;
  const validStartDate = new Date('2023-10-01T00:00:00Z');
  const validEndDate = new Date('2023-10-31T23:59:59Z');
  const validConfidenceLevel = 0.85;

  it('should successfully create a DemandForecast when all inputs are valid', () => {
    const forecast = new DemandForecast(
      validId,
      validSku,
      validLocationId,
      validQuantity,
      validStartDate,
      validEndDate,
      validConfidenceLevel
    );

    expect(forecast.id).toBe(validId);
    expect(forecast.sku).toBe(validSku);
    expect(forecast.locationId).toBe(validLocationId);
    expect(forecast.forecastedQuantity).toBe(validQuantity);
    expect(forecast.periodStart).toBe(validStartDate);
    expect(forecast.periodEnd).toBe(validEndDate);
    expect(forecast.confidenceLevel).toBe(validConfidenceLevel);
    expect(forecast.createdAt).toBeInstanceOf(Date);
  });

  it('should throw an error if forecastedQuantity is negative', () => {
    expect(() => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        -10, // Invalid: negative quantity
        validStartDate,
        validEndDate,
        validConfidenceLevel
      );
    }).toThrow('Forecasted quantity cannot be negative.');

  it('should throw an error if confidenceLevel is less than 0', () => {
        validQuantity,
        -0.1 // Invalid: confidence level < 0
    }).toThrow('Confidence level must be between 0 and 1.');

  it('should throw an error if confidenceLevel is greater than 1', () => {
        1.1 // Invalid: confidence level > 1

  it('should throw an error if periodStart is after periodEnd', () => {
        new Date('2023-10-31T23:59:59Z'), // Start is after end
        new Date('2023-10-01T00:00:00Z'),
    }).toThrow('Period start must be before period end.');

  it('should throw an error if periodStart is equal to periodEnd', () => {
    const sameDate = new Date('2023-10-15T12:00:00Z');
        sameDate, // Start is equal to end
        sameDate,
  const id = new DemandForecastId('df-123');
  const sku = new Sku('SKU-123');
  const locationId = new LocationId('loc-1');
  const periodStart = new Date('2024-01-01T00:00:00Z');
  const periodEnd = new Date('2024-01-31T23:59:59Z');

  it('should initialize with valid values', () => {
      id,
      sku,
      locationId,
      100,
      periodStart,
      periodEnd,
      0.8
    expect(forecast.id).toBe(id);
    expect(forecast.sku).toBe(sku);
    expect(forecast.locationId).toBe(locationId);
    expect(forecast.forecastedQuantity).toBe(100);
    expect(forecast.periodStart).toBe(periodStart);
    expect(forecast.periodEnd).toBe(periodEnd);
    expect(forecast.confidenceLevel).toBe(0.8);

  it('should throw error if forecasted quantity is negative', () => {
      new DemandForecast(id, sku, locationId, -1, periodStart, periodEnd, 0.8);

  it('should throw error if confidence level is negative', () => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodEnd, -0.1);

  it('should throw error if confidence level is greater than 1', () => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodEnd, 1.1);

  it('should throw error if period start is after or equal to period end', () => {
      new DemandForecast(id, sku, locationId, 100, periodEnd, periodStart, 0.8);

      new DemandForecast(id, sku, locationId, 100, periodStart, periodStart, 0.8);
    }).toThrow('Period start must be before period end.');
  });
});
