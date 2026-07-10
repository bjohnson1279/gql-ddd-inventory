import { GeoLocation } from "../../../src/domain/valueObjects/GeoLocation";

describe("GeoLocation Value Object (GraphQL)", () => {
  it("should create a valid geolocation", () => {
    const geo = new GeoLocation(40.7128, -74.0060);
    expect(geo.latitude).toBe(40.7128);
    expect(geo.longitude).toBe(-74.0060);
  });

  it("should throw error for invalid latitudes", () => {
    expect(() => new GeoLocation(-95, 0)).toThrow();
    expect(() => new GeoLocation(91, 0)).toThrow();
  });

  it("should throw error for invalid longitudes", () => {
    expect(() => new GeoLocation(0, -181)).toThrow();
    expect(() => new GeoLocation(0, 185)).toThrow();
  });

  it("should compute distance accurately using Haversine formula", () => {
    const ny = new GeoLocation(40.7128, -74.0060);
    const la = new GeoLocation(34.0522, -118.2437);

    const dist = ny.distanceTo(la);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it("should compute 0 distance for the same location", () => {
    const geo = new GeoLocation(40.7128, -74.0060);
    expect(geo.distanceTo(geo)).toBe(0);
  });
});
