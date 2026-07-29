import { DemandForecastId } from '../../../src/domain/valueObjects/DemandForecastId';

describe('DemandForecastId', () => {
  it('should correctly evaluate equality', () => {
    const id1 = new DemandForecastId('forecast-123');
    const id2 = new DemandForecastId('forecast-123');
    const id3 = new DemandForecastId('forecast-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });

  it('should throw an error if the id is empty', () => {
    expect(() => {
      new DemandForecastId('');
    }).toThrow('DemandForecastId cannot be empty.');

    expect(() => {
      new DemandForecastId('   ');
    }).toThrow('DemandForecastId cannot be empty.');

    expect(() => {
      new DemandForecastId(null as unknown as string);
    }).toThrow('DemandForecastId cannot be empty.');

    expect(() => {
      new DemandForecastId(undefined as unknown as string);
    }).toThrow('DemandForecastId cannot be empty.');
  });
});
