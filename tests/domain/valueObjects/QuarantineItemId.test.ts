import { QuarantineItemId } from '../../../src/domain/valueObjects/QuarantineItemId';

describe('QuarantineItemId', () => {
  it('should instantiate successfully with a valid non-empty string', () => {
    const id = new QuarantineItemId('quarantine-123');
    expect(id.value).toBe('quarantine-123');
  });

  it('should throw an error when initialized with an empty string or whitespace', () => {
    expect(() => new QuarantineItemId('')).toThrow('QuarantineItemId cannot be empty.');
    expect(() => new QuarantineItemId('   ')).toThrow('QuarantineItemId cannot be empty.');
    expect(() => new QuarantineItemId(null as unknown as string)).toThrow('QuarantineItemId cannot be empty.');
    expect(() => new QuarantineItemId(undefined as unknown as string)).toThrow('QuarantineItemId cannot be empty.');
  });

  it('should correctly compare two instances for equality', () => {
    const id1 = new QuarantineItemId('quarantine-123');
    const id2 = new QuarantineItemId('quarantine-123');
    const id3 = new QuarantineItemId('quarantine-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(null as unknown as QuarantineItemId)).toBe(false);
    expect(id1.equals({ value: 'quarantine-123' } as unknown as QuarantineItemId)).toBe(false);
  });
});
