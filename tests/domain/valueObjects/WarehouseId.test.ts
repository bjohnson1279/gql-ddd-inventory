import { WarehouseId } from '../../../src/domain/valueObjects/WarehouseId';

describe('WarehouseId Value Object', () => {
  it('should instantiate successfully with a valid non-empty string', () => {
    const id = new WarehouseId('WH-1');
    expect(id.value).toBe('WH-1');
  });

  it('should throw an error when initialized with an empty string', () => {
    expect(() => new WarehouseId('')).toThrow('WarehouseId cannot be empty.');
  });

  it('should throw an error when initialized with whitespace only', () => {
    expect(() => new WarehouseId('   ')).toThrow('WarehouseId cannot be empty.');
  });

  it('should return true for equals() when comparing identical warehouse IDs', () => {
    const id1 = new WarehouseId('WH-100');
    const id2 = new WarehouseId('WH-100');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should return false for equals() when comparing different warehouse IDs', () => {
    const id1 = new WarehouseId('WH-100');
    const id2 = new WarehouseId('WH-200');
    expect(id1.equals(id2)).toBe(false);
  });
});
