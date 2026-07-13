import { toUuid } from '../../../src/infrastructure/utils/uuid';

describe('toUuid', () => {
  it('should return a valid UUID string in lowercase when given a valid UUID string', () => {
    const validUuid = '123E4567-E89b-12d3-a456-426614174000';
    expect(toUuid(validUuid)).toBe(validUuid.toLowerCase());
  });

  it('should return a consistently generated UUID when given an arbitrary string', () => {
    const input = 'my-arbitrary-string';
    const uuid1 = toUuid(input);
    const uuid2 = toUuid(input);

    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(uuid1).toBe(uuid2);
  });
});
