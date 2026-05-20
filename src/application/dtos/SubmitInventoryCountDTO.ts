export interface CountItemInputDTO {
  sku: string;
  actualQuantity: number;
}

export interface CountResultDTO {
  sku: string;
  expected: number;
  actual: number;
  variance: number;
}
