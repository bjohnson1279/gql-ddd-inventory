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

  describe('Inventory Allocation Engine Invariants', () => {
    it('should initialize with default allocated and in-transit quantities of 0', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10));
      expect(item.allocated.value).toBe(0);
      expect(item.inTransit.value).toBe(0);
      expect(item.available.value).toBe(10);
    });

    it('should calculate available stock (ATP) correctly', () => {
      // On Hand: 10, Allocated: 3, In Transit: 5 -> Available: 10 - 3 + 5 = 12
      const item = new InventoryItem(
        '1',
        new Sku('S1'),
        new LocationId('L1'),
        new Quantity(10),
        new Quantity(3),
        new Quantity(5)
      );
      expect(item.available.value).toBe(12);
    });

    it('should clamp available stock to 0 if formula evaluates to negative', () => {
      // On Hand: 2, Allocated: 5, In Transit: 1 -> Available: 2 - 5 + 1 = -2 -> Clamped to 0
      const item = new InventoryItem(
        '1',
        new Sku('S1'),
        new LocationId('L1'),
        new Quantity(2),
        new Quantity(5),
        new Quantity(1)
      );
      expect(item.available.value).toBe(0);
    });

    it('should successfully allocate stock when available is sufficient', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10));
      item.allocateStock(new Quantity(4));
      expect(item.allocated.value).toBe(4);
      expect(item.available.value).toBe(6);
      expect(item.version).toBe(2);
    });

    it('should throw InsufficientAvailableStockError when allocating exceeds available', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(5));
      expect(() => item.allocateStock(new Quantity(6))).toThrow(
        /Insufficient available stock/
      );
      expect(item.allocated.value).toBe(0);
    });

    it('should successfully release allocated stock', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10), new Quantity(4));
      item.releaseAllocation(new Quantity(3));
      expect(item.allocated.value).toBe(1);
      expect(item.available.value).toBe(9);
    });

    it('should throw error when releasing more than allocated', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10), new Quantity(4));
      expect(() => item.releaseAllocation(new Quantity(5))).toThrow(/Cannot release allocation/);
    });

    it('should successfully fulfill allocated stock', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10), new Quantity(4));
      item.fulfillAllocation(new Quantity(3));
      expect(item.allocated.value).toBe(1);
      expect(item.quantity.value).toBe(7);
      expect(item.available.value).toBe(6); // 7 - 1 = 6
    });

    it('should throw error when fulfilling more than allocated', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10), new Quantity(4));
      expect(() => item.fulfillAllocation(new Quantity(5))).toThrow(/Cannot fulfill allocation/);
    });

    it('should successfully create in-transit stock', () => {
      const item = new InventoryItem('1', new Sku('S1'), new LocationId('L1'), new Quantity(10));
      item.createInTransit(new Quantity(5));
      expect(item.inTransit.value).toBe(5);
      expect(item.available.value).toBe(15); // 10 - 0 + 5 = 15
    });

    it('should successfully receive in-transit stock', () => {
      const item = new InventoryItem(
        '1',
        new Sku('S1'),
        new LocationId('L1'),
        new Quantity(10),
        new Quantity(0),
        new Quantity(5)
      );
      item.receiveInTransit(new Quantity(3));
      expect(item.inTransit.value).toBe(2);
      expect(item.quantity.value).toBe(13);
      expect(item.available.value).toBe(15); // 13 - 0 + 2 = 15
    });

    it('should throw error when receiving more than in transit', () => {
      const item = new InventoryItem(
        '1',
        new Sku('S1'),
        new LocationId('L1'),
        new Quantity(10),
        new Quantity(0),
        new Quantity(5)
      );
      expect(() => item.receiveInTransit(new Quantity(6))).toThrow(/Cannot receive in transit/);
    });
  });
});
