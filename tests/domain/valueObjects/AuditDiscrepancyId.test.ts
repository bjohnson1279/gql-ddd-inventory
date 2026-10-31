import { AuditDiscrepancyId } from '../../../src/domain/valueObjects/AuditDiscrepancyId';

describe('AuditDiscrepancyId', () => {
  it('should create a valid AuditDiscrepancyId', () => {
    const id = new AuditDiscrepancyId('audit-123');
    expect(id.value).toBe('audit-123');
  });

  it('should throw an error if the id is empty or whitespace', () => {
    expect(() => new AuditDiscrepancyId('')).toThrow('AuditDiscrepancyId cannot be empty.');
    expect(() => new AuditDiscrepancyId('   ')).toThrow('AuditDiscrepancyId cannot be empty.');
    expect(() => new AuditDiscrepancyId(null as unknown as string)).toThrow('AuditDiscrepancyId cannot be empty.');
    expect(() => new AuditDiscrepancyId(undefined as unknown as string)).toThrow('AuditDiscrepancyId cannot be empty.');
  });

  it('should correctly compare two AuditDiscrepancyId instances with equals', () => {
    const id1 = new AuditDiscrepancyId('audit-123');
    const id2 = new AuditDiscrepancyId('audit-123');
    const id3 = new AuditDiscrepancyId('audit-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(null as unknown as AuditDiscrepancyId)).toBe(false);
    expect(id1.equals({ value: 'audit-123' } as unknown as AuditDiscrepancyId)).toBe(false);
  });
});
