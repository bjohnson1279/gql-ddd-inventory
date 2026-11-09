import { TaskPerformanceId } from '../../../src/domain/valueObjects/TaskPerformanceId';

describe('TaskPerformanceId Value Object', () => {
  it('should instantiate successfully with a valid non-empty string', () => {
    const id = new TaskPerformanceId('tp-123');
    expect(id.value).toBe('tp-123');
  });

  it('should throw an error when initialized with an empty string', () => {
    expect(() => new TaskPerformanceId('')).toThrow('TaskPerformanceId cannot be empty.');
  });

  it('should throw an error when initialized with whitespace only', () => {
    expect(() => new TaskPerformanceId('   ')).toThrow('TaskPerformanceId cannot be empty.');
  });

  it('should throw an error when initialized with null or undefined', () => {
    expect(() => new TaskPerformanceId(null as unknown as string)).toThrow('TaskPerformanceId cannot be empty.');
    expect(() => new TaskPerformanceId(undefined as unknown as string)).toThrow('TaskPerformanceId cannot be empty.');
  });

  it('should return true for equals() when comparing identical task performance IDs', () => {
    const id1 = new TaskPerformanceId('tp-123');
    const id2 = new TaskPerformanceId('tp-123');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should return false for equals() when comparing different task performance IDs', () => {
    const id1 = new TaskPerformanceId('tp-123');
    const id2 = new TaskPerformanceId('tp-456');
    expect(id1.equals(id2)).toBe(false);
  });

  it('should return false for equals() when comparing with null, undefined, or non-TaskPerformanceId objects', () => {
    const id1 = new TaskPerformanceId('tp-123');
    expect(id1.equals(null as unknown as TaskPerformanceId)).toBe(false);
    expect(id1.equals(undefined as unknown as TaskPerformanceId)).toBe(false);
    expect(id1.equals({ value: 'tp-123' } as unknown as TaskPerformanceId)).toBe(false);
  });
});
