import { ManageRolesUseCase } from '../../../src/application/useCases/ManageRoles';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        role: {
          create: jest.fn(),
          findUnique: jest.fn(),
          delete: jest.fn(),
          findMany: jest.fn()
        },
        permission: {
          findMany: jest.fn()
        },
        rolePermission: {
          deleteMany: jest.fn(),
          createMany: jest.fn()
        },
        userRole: {
          createMany: jest.fn(),
          deleteMany: jest.fn(),
          findMany: jest.fn()
        },
        user: {
          findUnique: jest.fn()
        }
      };
    })
  };
});

describe('ManageRolesUseCase', () => {
  let useCase: ManageRolesUseCase;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = new PrismaClient();
    useCase = new ManageRolesUseCase(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomRole', () => {
    it('should create a custom role if permissions are valid', async () => {
      prismaMock.permission.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      prismaMock.role.create.mockResolvedValue({
        id: 'custom_t1_role_123',
        name: 'Manager',
        description: 'Store Manager',
        isCustom: true,
        rolePermissions: [
          { permission: { id: 'p1', resource: 'inv', action: 'view' } },
          { permission: { id: 'p2', resource: 'inv', action: 'edit' } }
        ]
      });

      const result = await useCase.createCustomRole('t1', 'Manager', 'Store Manager', ['p1', 'p2']);

      expect(prismaMock.permission.findMany).toHaveBeenCalledWith({ where: { id: { in: ['p1', 'p2'] } } });
      expect(prismaMock.role.create).toHaveBeenCalled();
      expect(result.id).toBe('custom_t1_role_123');
      expect(result.permissions.length).toBe(2);
    });

    it('should throw an error if permission IDs are invalid', async () => {
      prismaMock.permission.findMany.mockResolvedValue([{ id: 'p1' }]); // Missing p2

      await expect(useCase.createCustomRole('t1', 'Manager', 'desc', ['p1', 'p2'])).rejects.toThrow(/Invalid permission IDs/);
    });
  });

  describe('deleteCustomRole', () => {
    it('should delete a custom role with no assigned users', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role1',
        isCustom: true,
        userRoles: []
      });

      const result = await useCase.deleteCustomRole('role1');

      expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role1' } });
      expect(prismaMock.role.delete).toHaveBeenCalledWith({ where: { id: 'role1' } });
      expect(result).toBe(true);
    });

    it('should throw an error if role is not custom (system role)', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'admin',
        isCustom: false,
        userRoles: []
      });

      await expect(useCase.deleteCustomRole('admin')).rejects.toThrow(/Cannot delete a built-in system role/);
    });

    it('should throw an error if role has assigned users', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role1',
        isCustom: true,
        userRoles: [{ userId: 'u1' }]
      });

      await expect(useCase.deleteCustomRole('role1')).rejects.toThrow(/user\(s\) are currently assigned/);
    });
  });

  describe('assignRolesToUser', () => {
    it('should assign roles to user successfully', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
      prismaMock.role.findMany.mockResolvedValue([{ id: 'r1' }]);

      await useCase.assignRolesToUser('u1', ['r1']);

      expect(prismaMock.userRole.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', roleId: 'r1' }],
        skipDuplicates: true
      });
    });

    it('should throw error if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(useCase.assignRolesToUser('u1', ['r1'])).rejects.toThrow(/User 'u1' not found/);
    });

    it('should throw error if some role IDs do not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
      prismaMock.role.findMany.mockResolvedValue([{ id: 'r1' }]);

      await expect(useCase.assignRolesToUser('u1', ['r1', 'r2'])).rejects.toThrow(/Invalid role IDs: r2/);
    });
  });

  describe('updateRolePermissions', () => {
    it('should update permissions for an existing role and return it', async () => {
      prismaMock.role.findUnique
        .mockResolvedValueOnce({ id: 'role1', name: 'Role 1' })
        .mockResolvedValueOnce({
          id: 'role1',
          name: 'Role 1',
          description: 'Desc',
          isCustom: true,
          rolePermissions: [
            { permission: { id: 'p1', resource: 'inv', action: 'read', description: 'Read Inv' } }
          ]
        });

      const updated = await useCase.updateRolePermissions('role1', ['p1']);

      expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role1' } });
      expect(prismaMock.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 'role1', permissionId: 'p1' }],
        skipDuplicates: true
      });
      expect(updated.id).toBe('role1');
      expect(updated.permissions).toHaveLength(1);
    });

    it('should throw error if role is not found', async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);

      await expect(useCase.updateRolePermissions('non-existent', ['p1'])).rejects.toThrow(/Role 'non-existent' not found\./);
    });
  });

  describe('deleteCustomRole not found', () => {
    it('should throw error if role is not found', async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);

      await expect(useCase.deleteCustomRole('missing-role')).rejects.toThrow(/Role 'missing-role' not found\./);
    });
  });

  describe('listRoles', () => {
    it('should list all system and tenant custom roles', async () => {
      prismaMock.role.findMany.mockResolvedValue([
        {
          id: 'r_sys',
          name: 'Admin',
          description: 'System Admin',
          isCustom: false,
          rolePermissions: [
            { permission: { id: 'p1', resource: 'system', action: 'manage', description: 'Manage' } }
          ]
        },
        {
          id: 'r_custom',
          name: 'CustomRole',
          description: 'Custom',
          isCustom: true,
          rolePermissions: []
        }
      ]);

      const roles = await useCase.listRoles('tenant-1');

      expect(prismaMock.role.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { isCustom: false },
            { tenantId: 'tenant-1' }
          ]
        },
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        },
        orderBy: { name: 'asc' }
      });
      expect(roles).toHaveLength(2);
      expect(roles[0].permissions).toHaveLength(1);
      expect(roles[1].permissions).toHaveLength(0);
    });
  });

  describe('listPermissions', () => {
    it('should return all permissions ordered by resource and action', async () => {
      prismaMock.permission.findMany.mockResolvedValue([
        { id: 'p1', resource: 'inventory', action: 'create' },
        { id: 'p2', resource: 'inventory', action: 'view' }
      ]);

      const perms = await useCase.listPermissions();

      expect(prismaMock.permission.findMany).toHaveBeenCalledWith({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }]
      });
      expect(perms).toHaveLength(2);
    });
  });

  describe('removeRolesFromUser', () => {
    it('should delete specified roles from user', async () => {
      prismaMock.userRole.deleteMany.mockResolvedValue({ count: 2 });

      const result = await useCase.removeRolesFromUser('user-1', ['r1', 'r2']);

      expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          roleId: { in: ['r1', 'r2'] }
        }
      });
      expect(result).toBe(true);
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should return deduplicated effective permissions across all assigned user roles', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [
              { permission: { id: 'p1', resource: 'inv', action: 'read', description: 'Read' } },
              { permission: { id: 'p2', resource: 'inv', action: 'write', description: 'Write' } }
            ]
          }
        },
        {
          role: {
            rolePermissions: [
              { permission: { id: 'p1', resource: 'inv', action: 'read', description: 'Read' } }
            ]
          }
        }
      ]);

      const perms = await useCase.getUserEffectivePermissions('user-1');

      expect(prismaMock.userRole.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true }
              }
            }
          }
        }
      });
      expect(perms).toHaveLength(2);
      expect(perms.map(p => p.id)).toEqual(['p1', 'p2']);
    });
  });
});
