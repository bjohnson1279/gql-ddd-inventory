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

  it('should throw error if confidence level is negative', () => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodEnd, -0.1);
    }).toThrow('Confidence level must be between 0 and 1.');

  it('should throw error if confidence level is greater than 1', () => {
      new DemandForecast(id, sku, locationId, 100, periodStart, periodEnd, 1.1);

  it('should throw error if period start is after or equal to period end', () => {
      new DemandForecast(id, sku, locationId, 100, periodEnd, periodStart, 0.8);
    }).toThrow('Period start must be before period end.');

      new DemandForecast(id, sku, locationId, 100, periodStart, periodStart, 0.8);
  const validId = new DemandForecastId('df-123');
  const validSku = new Sku('SKU-123');
  const validLocationId = new LocationId('loc-456');
  const validQuantity = 100;
  const validPeriodStart = new Date('2024-01-01T00:00:00Z');
  const validPeriodEnd = new Date('2024-02-01T00:00:00Z');
  const validConfidenceLevel = 0.9;

  it('should create a DemandForecast instance successfully when valid parameters are provided', () => {
      validId,
      validSku,
      validLocationId,
      validQuantity,
      validPeriodStart,
      validPeriodEnd,
      validConfidenceLevel

    expect(forecast.id).toBe(validId);
    expect(forecast.sku).toBe(validSku);
    expect(forecast.locationId).toBe(validLocationId);
    expect(forecast.forecastedQuantity).toBe(validQuantity);
    expect(forecast.periodStart).toBe(validPeriodStart);
    expect(forecast.periodEnd).toBe(validPeriodEnd);
    expect(forecast.confidenceLevel).toBe(validConfidenceLevel);

  it('should throw an error when forecastedQuantity is less than 0', () => {
      new DemandForecast(
        validId,
        validSku,
        validLocationId,
        -10, // Invalid quantity
        validPeriodStart,
        validPeriodEnd,
        validConfidenceLevel
      );

  it('should throw an error when confidenceLevel is less than 0', () => {
        validQuantity,
        -0.1 // Invalid confidence level

  it('should throw an error when confidenceLevel is greater than 1', () => {
        1.5 // Invalid confidence level

  it('should throw an error when periodStart is equal to periodEnd', () => {
        validPeriodStart, // Start equals End

  it('should throw an error when periodStart is after periodEnd', () => {
        validPeriodEnd, // Start is after End
    }).toThrow('Period start must be before period end.');
  });
});
