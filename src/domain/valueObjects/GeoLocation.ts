export class GeoLocation {
  private readonly _latitude: number;
  private readonly _longitude: number;

  constructor(latitude: number, longitude: number) {
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("Latitude must be a valid number between -90 and 90");
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Longitude must be a valid number between -180 and 180");
    }
    this._latitude = latitude;
    this._longitude = longitude;
  }

  get latitude(): number {
    return this._latitude;
  }

  get longitude(): number {
    return this._longitude;
  }

  /**
   * Calculates the distance to another geolocation in kilometers using the Haversine formula.
   */
  public distanceTo(other: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((other.latitude - this._latitude) * Math.PI) / 180;
    const dLon = ((other.longitude - this._longitude) * Math.PI) / 180;
    const lat1 = (this._latitude * Math.PI) / 180;
    const lat2 = (other.latitude * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  equals(other: GeoLocation): boolean {
    return this._latitude === other.latitude && this._longitude === other.longitude;
  }
}
