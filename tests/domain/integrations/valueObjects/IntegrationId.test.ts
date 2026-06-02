import { IntegrationId } from '../../../../src/domain/integrations/valueObjects/IntegrationId';

describe('IntegrationId', () => {
  it('should correctly evaluate equality', () => {
    const id1 = new IntegrationId('int-123');
    const id2 = new IntegrationId('int-123');
    const id3 = new IntegrationId('int-456');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });

  it('should throw an error if the id is empty', () => {
    expect(() => {
      new IntegrationId('');
    }).toThrow('IntegrationId cannot be empty.');

    expect(() => {
      new IntegrationId('   ');
    }).toThrow('IntegrationId cannot be empty.');
  });
});
