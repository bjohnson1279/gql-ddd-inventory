import { InventoryItemId } from '../../../src/domain/valueObjects/InventoryItemId';

describe('InventoryItemId', () => {
  it('should create a valid InventoryItemId', () => {
    const id = new InventoryItemId('inv-123');
    expect(id.value).toBe('inv-123');
  });

  it('should throw an error for empty or whitespace-only value', () => {
    expect(() => new InventoryItemId('')).toThrow('InventoryItemId cannot be empty.');
    expect(() => new InventoryItemId('   ')).toThrow('InventoryItemId cannot be empty.');
  });

  it('should correctly compare two InventoryItemId instances with equals', () => {
    const id1 = new InventoryItemId('inv-123');
    const id2 = new InventoryItemId('inv-123');
    const id3 = new InventoryItemId('inv-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});
