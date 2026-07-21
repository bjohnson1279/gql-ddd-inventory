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

export class InsufficientAvailableStockError extends Error {
  constructor(sku: string, requested: number, available: number) {
    super(`Insufficient available stock (ATP) for SKU ${sku}. Requested: ${requested}, Available: ${available}`);
    this.name = 'InsufficientAvailableStockError';
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

export class ConcurrencyError extends Error {
  constructor(sku: string, locationId: string) {
    super(`Concurrency error: Item with SKU ${sku} at location ${locationId} was modified by another process.`);
    this.name = 'ConcurrencyError';
  }
}

export class CapacityExceededError extends Error {
  constructor(locationId: string, limitType: 'weight' | 'volume', limit: number, prospective: number) {
    super(`Capacity exceeded at location ${locationId}: ${limitType} limit is ${limit}, but prospective ${limitType} is ${prospective}.`);
    this.name = 'CapacityExceededError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
