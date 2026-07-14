import { toUuid } from '../../../src/infrastructure/utils/uuid';
import * as crypto from 'crypto';

describe('uuid utils', () => {
  describe('toUuid', () => {
    it('should return the lowercase id if it is already a valid UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const upperValidUuid = '123E4567-E89B-12D3-A456-426614174000';

      expect(toUuid(validUuid)).toBe(validUuid);
      expect(toUuid(upperValidUuid)).toBe(validUuid);
    });

    it('should generate a consistent UUID format string for a non-UUID input using sha256', () => {
      const input = 'my-custom-id';
      const result = toUuid(input);

      const expectedHash = crypto.createHash('sha256').update(input).digest('hex');
      const expectedUuid = `${expectedHash.substring(0, 8)}-${expectedHash.substring(8, 12)}-${expectedHash.substring(12, 16)}-${expectedHash.substring(16, 20)}-${expectedHash.substring(20, 32)}`;

      expect(result).toBe(expectedUuid);
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate the same UUID format string for the same input', () => {
      const input = 'another-custom-id';
      const result1 = toUuid(input);
      const result2 = toUuid(input);

      expect(result1).toBe(result2);
    });
  });
});
