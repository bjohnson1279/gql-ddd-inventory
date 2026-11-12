import { ApprovalWorkflowId } from '../../../src/domain/valueObjects/ApprovalWorkflowId';

describe('ApprovalWorkflowId', () => {
  it('should create a valid ApprovalWorkflowId', () => {
    const id = new ApprovalWorkflowId('wf-123');
    expect(id.value).toBe('wf-123');
  });

  it('should throw an error if the id is empty or whitespace', () => {
    expect(() => new ApprovalWorkflowId('')).toThrow('ApprovalWorkflowId cannot be empty.');
    expect(() => new ApprovalWorkflowId('   ')).toThrow('ApprovalWorkflowId cannot be empty.');
    expect(() => new ApprovalWorkflowId(null as unknown as string)).toThrow('ApprovalWorkflowId cannot be empty.');
    expect(() => new ApprovalWorkflowId(undefined as unknown as string)).toThrow('ApprovalWorkflowId cannot be empty.');
  });

  it('should correctly compare two ApprovalWorkflowId instances with equals', () => {
    const id1 = new ApprovalWorkflowId('wf-123');
    const id2 = new ApprovalWorkflowId('wf-123');
    const id3 = new ApprovalWorkflowId('wf-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(null as unknown as ApprovalWorkflowId)).toBe(false);
    expect(id1.equals({ value: 'wf-123' } as unknown as ApprovalWorkflowId)).toBe(false);
  });

  it('should return string value on toString()', () => {
    const id = new ApprovalWorkflowId('wf-123');
    expect(id.toString()).toBe('wf-123');
  });
});
