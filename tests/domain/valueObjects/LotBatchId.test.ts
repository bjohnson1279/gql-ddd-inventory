import { LotBatchId } from '../../../src/domain/valueObjects/LotBatchId';

describe('LotBatchId', () => {
  it('should create a valid LotBatchId', () => {
    const id = new LotBatchId('lot-batch-123');
    expect(id.value).toBe('lot-batch-123');
  });

  it('should throw an error if the id is empty or whitespace', () => {
    expect(() => new LotBatchId('')).toThrow('LotBatchId cannot be empty.');
    expect(() => new LotBatchId('   ')).toThrow('LotBatchId cannot be empty.');
    expect(() => new LotBatchId(null as unknown as string)).toThrow('LotBatchId cannot be empty.');
    expect(() => new LotBatchId(undefined as unknown as string)).toThrow('LotBatchId cannot be empty.');
  });

  it('should correctly compare two LotBatchId instances with equals', () => {
    const id1 = new LotBatchId('lot-123');
    const id2 = new LotBatchId('lot-123');
    const id3 = new LotBatchId('lot-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(null as unknown as LotBatchId)).toBe(false);
    expect(id1.equals({ value: 'lot-123' } as unknown as LotBatchId)).toBe(false);
  });
});
