import { InventoryItemFactory } from '../factories/InventoryItemFactory';
import { Quantity } from '../../src/domain/valueObjects/Quantity';
import { InsufficientStockError } from '../../src/domain/exceptions/DomainErrors';

describe('InventoryItem', () => {
  it('should successfully receive stock', () => {
    // Arrange: Create an item with 10 stock using the factory
    const item = new InventoryItemFactory().withQuantity(10).build();
    const newStock = new Quantity(5);

    // Act
    item.receiveStock(newStock);

    // Assert
    expect(item.quantity.value).toBe(15);
  });

  it('should successfully dispatch stock when enough is available', () => {
    // Arrange
    const item = new InventoryItemFactory().withQuantity(20).build();
    const stockToDispatch = new Quantity(5);

    // Act
    item.dispatchStock(stockToDispatch);

    // Assert
    expect(item.quantity.value).toBe(15);
  });

  it('should throw an InsufficientStockError when dispatching more than available', () => {
    // Arrange
    const item = new InventoryItemFactory()
      .withSku('MACBOOK-PRO')
      .withQuantity(2)
      .build();
    const stockToDispatch = new Quantity(5);

    // Act & Assert
    expect(() => {
      item.dispatchStock(stockToDispatch);
    }).toThrow(InsufficientStockError);

    // Verify the stock wasn't changed
    expect(item.quantity.value).toBe(2);
  });
});
