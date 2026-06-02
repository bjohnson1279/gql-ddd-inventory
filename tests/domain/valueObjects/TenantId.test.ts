import { TenantId } from '../../../src/domain/valueObjects/TenantId';

describe('TenantId', () => {
  it('should correctly evaluate equality', () => {
    const id1 = new TenantId('tenant-123');
    const id2 = new TenantId('tenant-123');
    const id3 = new TenantId('tenant-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});
