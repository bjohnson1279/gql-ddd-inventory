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
      .withLocationId('WAREHOUSE-1')
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

  it('should record a LowStockAlertEvent when stock drops below 10', () => {
    // Arrange
    const item = new InventoryItemFactory()
      .withSku('MACBOOK-PRO')
      .withLocationId('WAREHOUSE-1')
      .withQuantity(15)
      .build();
    
    const stockToDispatch = new Quantity(6);

    // Act
    item.dispatchStock(stockToDispatch);

    // Assert
    expect(item.quantity.value).toBe(9);
    const events = item.pullDomainEvents();
    expect(events.length).toBe(1);
    expect(events[0].constructor.name).toBe('LowStockAlertEvent');
    expect((events[0] as any).currentQuantity).toBe(9);
  });

  it('should clear domain events when pulled', () => {
    // Arrange
    const item = new InventoryItemFactory()
      .withQuantity(15)
      .build();
    
    item.dispatchStock(new Quantity(10));

    // Act
    const events1 = item.pullDomainEvents();
    const events2 = item.pullDomainEvents();

    // Assert
    expect(events1.length).toBe(1);
    expect(events2.length).toBe(0);
  });
});
