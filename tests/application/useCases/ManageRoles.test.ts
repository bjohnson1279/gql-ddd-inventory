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
  });
});
