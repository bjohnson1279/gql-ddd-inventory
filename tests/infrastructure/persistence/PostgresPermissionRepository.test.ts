import { PostgresPermissionRepository } from '../../../src/infrastructure/persistence/PostgresPermissionRepository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        userRole: {
          findMany: jest.fn()
        },
        rolePermission: {
          findMany: jest.fn()
        }
      };
    })
  };
});

describe('PostgresPermissionRepository', () => {
  let repository: PostgresPermissionRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = new PrismaClient();
    repository = new PostgresPermissionRepository(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should find permissions by userId', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          rolePermissions: [
            {
              permission: {
                id: 'p1',
                resource: 'inventory',
                action: 'read',
                description: 'Read inventory'
              }
            }
          ]
        }
      }
    ]);

    const permissions = await repository.findPermissionsByUserId('user-1');
    expect(permissions).toHaveLength(1);
    expect(permissions[0].id).toBe('p1');
    expect(permissions[0].key).toBe('inventory:read');
    expect(prismaMock.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
  });

  it('should find permissions by roleIds', async () => {
    prismaMock.rolePermission.findMany.mockResolvedValue([
      {
        permission: {
          id: 'p2',
          resource: 'order',
          action: 'write',
          description: 'Write order'
        }
      }
    ]);

    const permissions = await repository.findPermissionsByRoleIds(['role-1']);
    expect(permissions).toHaveLength(1);
    expect(permissions[0].id).toBe('p2');
    expect(permissions[0].key).toBe('order:write');
    expect(prismaMock.rolePermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roleId: { in: ['role-1'] } } })
    );
  });
});
