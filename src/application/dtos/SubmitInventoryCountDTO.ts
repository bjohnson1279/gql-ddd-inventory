export interface CountItemInputDTO {
  sku: string;
  locationId: string;
  actualQuantity: number;
}

export interface CountResultDTO {
  sku: string;
  locationId: string;
  expected: number;
  actual: number;
  variance: number;
}
