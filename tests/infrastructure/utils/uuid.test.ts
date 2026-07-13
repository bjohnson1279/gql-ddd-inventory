import { toUuid } from '../../../src/infrastructure/utils/uuid';
import * as crypto from 'crypto';

describe('toUuid', () => {
  it('should return the same UUID if a valid UUID is provided', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(toUuid(validUuid)).toBe(validUuid);
  });

  it('should lowercase a valid UUID', () => {
    const validUuidUpper = '123E4567-E89B-12D3-A456-426614174000';
    expect(toUuid(validUuidUpper)).toBe(validUuidUpper.toLowerCase());
  });

  it('should generate a valid UUID format from a non-UUID string using sha256', () => {
    const input = 'some-non-uuid-string';
    const result = toUuid(input);

    // Verify it matches UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(result)).toBe(true);

    // Verify it matches the sha256 hash logic
    const expectedHash = crypto.createHash('sha256').update(input).digest('hex');
    const expectedResult = `${expectedHash.substring(0, 8)}-${expectedHash.substring(8, 12)}-${expectedHash.substring(12, 16)}-${expectedHash.substring(16, 20)}-${expectedHash.substring(20, 32)}`;

    expect(result).toBe(expectedResult);
  });

  it('should be deterministic for non-UUID strings', () => {
    const input = 'another-string';
    expect(toUuid(input)).toBe(toUuid(input));
  });

  it('should return different UUIDs for different inputs', () => {
    expect(toUuid('input1')).not.toBe(toUuid('input2'));
  });
});
