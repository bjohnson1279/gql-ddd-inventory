import { InventoryItemFactory } from '../factories/InventoryItemFactory';
import { Quantity } from '../../src/domain/valueObjects/Quantity';
import { InsufficientStockError } from '../../src/domain/exceptions/DomainErrors';
import { InventoryItem } from '../../src/domain/entities/InventoryItem';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { LocationId } from '../../src/domain/valueObjects/LocationId';

describe('InventoryItem', () => {
  it('should successfully receive stock', () => {
    // Arrange: Create an item with 10 stock using the factory
    const item = new InventoryItemFactory().withQuantity(10).withVersion(1).build();
    const stockToReceive = new Quantity(5);

    // Act
    item.receiveStock(stockToReceive);

    // Assert
    expect(item.quantity.value).toBe(15);
    expect(item.version).toBe(2);
  });

  it('should successfully dispatch stock and increment version', () => {
    // Arrange
    const item = new InventoryItemFactory().withQuantity(10).withVersion(1).build();
    const stockToDispatch = new Quantity(3);

    // Act
    item.dispatchStock(stockToDispatch);

    // Assert
    expect(item.quantity.value).toBe(7);
    expect(item.version).toBe(2);
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

  it('should initialize with correct default values and version 1', () => {
    // Arrange
    const sku = new Sku('MACBOOK-PRO');
    const locationId = new LocationId('LOC-1');
    const quantity = new Quantity(10);
    const id = '123';

    // Act
    const item = new InventoryItem(id, sku, locationId, quantity);

    // Assert
    expect(item.id).toBe('123');
    expect(item.sku.value).toBe('MACBOOK-PRO');
    expect(item.quantity.value).toBe(10);
    expect(item.version).toBe(1);
  });

  it('should increment version when receiving stock', () => {
    // Arrange
    const item = new InventoryItemFactory().withQuantity(10).withVersion(1).build();

    // Act
    item.receiveStock(new Quantity(5));

    // Assert
    expect(item.quantity.value).toBe(15);
    expect(item.version).toBe(2);
  });
});
