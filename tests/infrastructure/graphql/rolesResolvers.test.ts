import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { ManageRolesUseCase } from '../../../src/application/useCases/ManageRoles';

// Mock the use case so we don't need the DB for the resolver layer test
jest.mock('../../../src/application/useCases/ManageRoles');

describe('Roles Resolvers', () => {
  const mockContext = {
    auth: {
      tenantId: 't-1',
      actorId: 'admin-1',
      role: 'admin',
      permissions: ['user:view']
    },
    prisma: {} as any
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.roles', () => {
    it('should return roles for tenant', async () => {
      const mockRoles = [{ id: 'role1', name: 'Admin', isCustom: false, permissions: [] }];
      (ManageRolesUseCase.prototype.listRoles as jest.Mock).mockResolvedValue(mockRoles);

      const result = await (resolvers.Query as any).roles(null, { tenantId: 't-1' }, mockContext);

      expect(ManageRolesUseCase.prototype.listRoles).toHaveBeenCalledWith('t-1');
      expect(result).toEqual(mockRoles);
    });

    it('should throw forbidden if no permissions', async () => {
      const forbiddenContext = {
        auth: { tenantId: 't-1', actorId: 'user-1', role: 'viewer', permissions: [] },
        prisma: {} as any
      };

      await expect((resolvers.Query as any).roles(null, { tenantId: 't-1' }, forbiddenContext))
        .rejects.toThrow(/Forbidden/);
    });
  });

  describe('Query.permissions', () => {
    it('should list all permissions', async () => {
      const mockPerms = [{ id: 'p1', resource: 'inv', action: 'view' }];
      (ManageRolesUseCase.prototype.listPermissions as jest.Mock).mockResolvedValue(mockPerms);

      const result = await (resolvers.Query as any).permissions(null, {}, mockContext);

      expect(ManageRolesUseCase.prototype.listPermissions).toHaveBeenCalled();
      expect(result).toEqual(mockPerms);
    });
  });

  describe('Query.userEffectivePermissions', () => {
    it('should list effective permissions for user', async () => {
      const mockPerms = [{ id: 'p1' }];
      (ManageRolesUseCase.prototype.getUserEffectivePermissions as jest.Mock).mockResolvedValue(mockPerms);

      const result = await (resolvers.Query as any).userEffectivePermissions(null, { userId: 'u1' }, mockContext);

      expect(ManageRolesUseCase.prototype.getUserEffectivePermissions).toHaveBeenCalledWith('u1');
      expect(result).toEqual(mockPerms);
    });
  });
});
