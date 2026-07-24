import { RouteOrder, RouteOrderCommand } from "../../../src/application/useCases/RouteOrder";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";

describe("RouteOrder Use Case", () => {
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let carrierService: any;
  let routeOrder: RouteOrder;

  beforeEach(() => {
    inventoryRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findByLocation: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    carrierService = {
      getRates: jest.fn(),
    };

    routeOrder = new RouteOrder(inventoryRepository, carrierService);
  });

  it("should throw an error when routing parameters are missing", async () => {
    const incompleteCommand: Partial<RouteOrderCommand> = {
      sku: "SKU-123",
      quantity: 10,
      // destinationAddress is intentionally missing
    };

    await expect(
      routeOrder.execute(incompleteCommand as RouteOrderCommand)
    ).rejects.toThrow("Missing required routing parameters: sku, quantity, and destinationAddress.");
  });

  it("should throw an error when sku is missing", async () => {
    const incompleteCommand: Partial<RouteOrderCommand> = {
      quantity: 10,
      destinationAddress: "123 Main St, New York, NY 10001",
    };

    await expect(
      routeOrder.execute(incompleteCommand as RouteOrderCommand)
    ).rejects.toThrow("Missing required routing parameters: sku, quantity, and destinationAddress.");
  });

  it("should throw an error when quantity is missing", async () => {
    const incompleteCommand: Partial<RouteOrderCommand> = {
      sku: "SKU-123",
      destinationAddress: "123 Main St, New York, NY 10001",
    };

    await expect(
      routeOrder.execute(incompleteCommand as RouteOrderCommand)
    ).rejects.toThrow("Missing required routing parameters: sku, quantity, and destinationAddress.");
  });
});
