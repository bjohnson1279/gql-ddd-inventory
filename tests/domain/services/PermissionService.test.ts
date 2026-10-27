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
});
