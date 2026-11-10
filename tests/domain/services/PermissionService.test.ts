import { PermissionService } from '../../../src/domain/services/PermissionService';
import { IPermissionRepository } from '../../../src/domain/repositories/IPermissionRepository';
import { Permission } from '../../../src/domain/entities/Permission';

describe('PermissionService', () => {
  let service: PermissionService;
  let permissionRepoMock: jest.Mocked<IPermissionRepository>;

  beforeEach(() => {
    permissionRepoMock = {
      findPermissionsByUserId: jest.fn(),
      findPermissionsByRoleIds: jest.fn(),
    };
    service = new PermissionService(permissionRepoMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return permission keys for a user based on their roles', async () => {
    permissionRepoMock.findPermissionsByUserId.mockResolvedValue([
      new Permission('perm-1', 'purchase_order', 'place', 'Place PO'),
      new Permission('perm-2', 'inventory', 'view', 'View inventory')
    ]);

    const keys = await service.getUserPermissionKeys('user-1');
    expect(keys).toEqual(['purchase_order:place', 'inventory:view']);
    expect(permissionRepoMock.findPermissionsByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should return empty array if user has no roles', async () => {
    permissionRepoMock.findPermissionsByUserId.mockResolvedValue([]);
    const keys = await service.getUserPermissionKeys('user-unknown');
    expect(keys).toEqual([]);
  });

  it('should correctly evaluate hasPermission exact match', async () => {
    permissionRepoMock.findPermissionsByUserId.mockResolvedValue([
      new Permission('perm-3', 'inventory', 'dispatch', 'Dispatch inventory')
    ]);

    const hasAccess = await service.hasPermission('user-1', 'inventory', 'dispatch');
    expect(hasAccess).toBe(true);
    
    const noAccess = await service.hasPermission('user-1', 'inventory', 'view');
    expect(noAccess).toBe(false);
  });

  describe('getEffectivePermissionKeys', () => {
    it('returns empty array when given an empty roleIds list', async () => {
      const keys = await service.getEffectivePermissionKeys([]);
      expect(keys).toEqual([]);
      expect(permissionRepoMock.findPermissionsByRoleIds).not.toHaveBeenCalled();
    });

    it('returns deduplicated permission keys for given roleIds', async () => {
      permissionRepoMock.findPermissionsByRoleIds.mockResolvedValue([
        new Permission('p1', 'orders', 'create', 'Create order'),
        new Permission('p2', 'orders', 'view', 'View order'),
        new Permission('p3', 'orders', 'create', 'Duplicate key from different role')
      ]);

      const keys = await service.getEffectivePermissionKeys(['role-1', 'role-2']);
      expect(keys).toEqual(['orders:create', 'orders:view']);
      expect(permissionRepoMock.findPermissionsByRoleIds).toHaveBeenCalledWith(['role-1', 'role-2']);
    });
  });

  describe('getUserPermissions', () => {
    it('returns deduplicated full permission objects for a user', async () => {
      permissionRepoMock.findPermissionsByUserId.mockResolvedValue([
        new Permission('p1', 'catalog', 'read', 'Read catalog'),
        new Permission('p2', 'catalog', 'write', 'Write catalog'),
        new Permission('p1', 'catalog', 'read', 'Duplicate permission id')
      ]);

      const permissions = await service.getUserPermissions('user-1');
      expect(permissions).toEqual([
        { id: 'p1', resource: 'catalog', action: 'read', description: 'Read catalog' },
        { id: 'p2', resource: 'catalog', action: 'write', description: 'Write catalog' }
      ]);
      expect(permissionRepoMock.findPermissionsByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns empty array when user has no permissions', async () => {
      permissionRepoMock.findPermissionsByUserId.mockResolvedValue([]);
      const permissions = await service.getUserPermissions('user-empty');
      expect(permissions).toEqual([]);
    });
  });

  describe('hasPermission edge cases', () => {
    it('returns false when user has no permissions assigned', async () => {
      permissionRepoMock.findPermissionsByUserId.mockResolvedValue([]);
      const hasAccess = await service.hasPermission('user-none', 'orders', 'delete');
      expect(hasAccess).toBe(false);
    });
  });
});
