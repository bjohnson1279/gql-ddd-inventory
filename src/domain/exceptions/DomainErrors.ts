export class InsufficientStockError extends Error {
  constructor(sku: string, requested: number, available: number) {
    super(`Insufficient stock for SKU ${sku}. Requested: ${requested}, Available: ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
  }
}

export class OnboardingAlreadySubmittedError extends Error {
  constructor(id: string) {
    super(`Onboarding ${id} has already been submitted and is immutable.`);
    this.name = 'OnboardingAlreadySubmittedError';
  }
}

export class OpeningBalanceConflictError extends Error {
  constructor(sku: string, locationId: string) {
    super(`Opening balance already exists for SKU ${sku} at location ${locationId}.`);
    this.name = 'OpeningBalanceConflictError';
  }
}
