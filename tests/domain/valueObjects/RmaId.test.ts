import { RmaId } from '../../../src/domain/valueObjects/RmaId';

describe('RmaId', () => {
  it('should create a valid RmaId', () => {
    const id = new RmaId('rma-123');
    expect(id.value).toBe('rma-123');
  });

  it('should throw an error for empty or whitespace-only value', () => {
    expect(() => new RmaId('')).toThrow('RmaId cannot be empty.');
    expect(() => new RmaId('   ')).toThrow('RmaId cannot be empty.');
    expect(() => new RmaId(null as unknown as string)).toThrow('RmaId cannot be empty.');
    expect(() => new RmaId(undefined as unknown as string)).toThrow('RmaId cannot be empty.');
  });

  it('should correctly evaluate equality', () => {
    const id1 = new RmaId('rma-123');
    const id2 = new RmaId('rma-123');
    const id3 = new RmaId('rma-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});
