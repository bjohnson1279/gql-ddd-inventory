import { Permission } from '../../../src/domain/entities/Permission';

describe('Permission', () => {
  describe('instantiation', () => {
    it('creates a valid Permission with id, resource, action, and description', () => {
      const permission = new Permission('perm-1', 'inventory', 'view', 'View inventory items');

      expect(permission.id).toBe('perm-1');
      expect(permission.resource).toBe('inventory');
      expect(permission.action).toBe('view');
      expect(permission.description).toBe('View inventory items');
    });

    it('creates a valid Permission defaulting description to empty string', () => {
      const permission = new Permission('perm-2', 'orders', 'create');

      expect(permission.id).toBe('perm-2');
      expect(permission.resource).toBe('orders');
      expect(permission.action).toBe('create');
      expect(permission.description).toBe('');
    });

    it('throws an error when resource is empty or whitespace-only', () => {
      expect(() => new Permission('p1', '', 'read')).toThrow('Permission resource cannot be empty.');
      expect(() => new Permission('p1', '   ', 'read')).toThrow('Permission resource cannot be empty.');
    });

    it('throws an error when action is empty or whitespace-only', () => {
      expect(() => new Permission('p1', 'inventory', '')).toThrow('Permission action cannot be empty.');
      expect(() => new Permission('p1', 'inventory', '   ')).toThrow('Permission action cannot be empty.');
    });
  });

  describe('key getter', () => {
    it('returns resource:action format', () => {
      const permission = new Permission('p1', 'warehouse', 'dispatch');
      expect(permission.key).toBe('warehouse:dispatch');
    });
  });

  describe('matches', () => {
    it('returns true when resource and action match exactly', () => {
      const permission = new Permission('p1', 'warehouse', 'dispatch');
      expect(permission.matches('warehouse', 'dispatch')).toBe(true);
    });

    it('returns false when resource or action does not match', () => {
      const permission = new Permission('p1', 'warehouse', 'dispatch');
      expect(permission.matches('warehouse', 'receive')).toBe(false);
      expect(permission.matches('inventory', 'dispatch')).toBe(false);
      expect(permission.matches('other', 'other')).toBe(false);
    });
  });

  describe('matchesKey', () => {
    it('returns true when key matches exactly', () => {
      const permission = new Permission('p1', 'warehouse', 'dispatch');
      expect(permission.matchesKey('warehouse:dispatch')).toBe(true);
    });

    it('returns false when key does not match', () => {
      const permission = new Permission('p1', 'warehouse', 'dispatch');
      expect(permission.matchesKey('warehouse:receive')).toBe(false);
      expect(permission.matchesKey('invalid-key')).toBe(false);
    });
  });
});
