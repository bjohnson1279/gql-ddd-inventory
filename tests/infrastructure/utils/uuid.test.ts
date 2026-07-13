import { toUuid } from '../../../src/infrastructure/utils/uuid';
import * as crypto from 'crypto';

describe('toUuid', () => {
  it('should return the original string if it is already a valid UUID', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(toUuid(validUuid)).toBe(validUuid);
  });

  it('should format upper-case UUIDs to lower-case', () => {
    const upperUuid = '123E4567-E89B-12D3-A456-426614174000';
    expect(toUuid(upperUuid)).toBe(upperUuid.toLowerCase());
  });

  it('should convert a non-UUID string into a properly formatted UUID using SHA-256', () => {
    const nonUuid = 'some-arbitrary-string';
    const result = toUuid(nonUuid);

    // Verify it matches the UUID pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(result)).toBe(true);

    // Verify it matches SHA-256 logic
    const hash = crypto.createHash('sha256').update(nonUuid).digest('hex');
    const expected = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;

    expect(result).toBe(expected);
  });

  it('should produce stable outputs for the same input', () => {
    const input = 'another-test-string';
    expect(toUuid(input)).toBe(toUuid(input));
  });
});
