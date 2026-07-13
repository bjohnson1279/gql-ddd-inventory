import { toUuid } from '../../../src/infrastructure/utils/uuid';
import * as crypto from 'crypto';

describe('toUuid', () => {
  it('should return the identical lowercase UUID if input is already a valid UUID', () => {
    const validUuidLower = '123e4567-e89b-12d3-a456-426614174000';
    expect(toUuid(validUuidLower)).toBe(validUuidLower);

    const validUuidUpper = '123E4567-E89B-12D3-A456-426614174000';
    expect(toUuid(validUuidUpper)).toBe(validUuidLower);
  });

  it('should deterministically generate a valid UUID format from an arbitrary string using SHA-256', () => {
    const input = 'some-arbitrary-external-id';
    const result = toUuid(input);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(result)).toBe(true);

    const expectedHash = crypto.createHash('sha256').update(input).digest('hex');
    const expectedUuid = `${expectedHash.substring(0, 8)}-${expectedHash.substring(8, 12)}-${expectedHash.substring(12, 16)}-${expectedHash.substring(16, 20)}-${expectedHash.substring(20, 32)}`;

    expect(result).toBe(expectedUuid);
  });

  it('should generate different UUIDs for different inputs', () => {
    const result1 = toUuid('input-1');
    const result2 = toUuid('input-2');

    expect(result1).not.toBe(result2);
  });
});
