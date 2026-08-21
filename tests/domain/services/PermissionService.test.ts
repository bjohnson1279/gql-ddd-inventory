import { PermissionService } from '../../../src/domain/services/PermissionService';
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

describe('PermissionService', () => {
  let service: PermissionService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = new PrismaClient();
    service = new PermissionService(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return permission keys for a user based on their roles', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          rolePermissions: [
            { permission: { resource: 'purchase_order', action: 'place' } },
            { permission: { resource: 'inventory', action: 'view' } }
          ]
        }
      }
    ]);

    const keys = await service.getUserPermissionKeys('user-1');
    expect(keys).toEqual(['purchase_order:place', 'inventory:view']);
    expect(prismaMock.userRole.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
  });

  it('should return empty array if user has no roles', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([]);
    const keys = await service.getUserPermissionKeys('user-unknown');
    expect(keys).toEqual([]);
  });

  it('should correctly evaluate hasPermission exact match', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          rolePermissions: [
            { permission: { resource: 'inventory', action: 'dispatch' } }
          ]
        }
      }
    ]);

    const hasAccess = await service.hasPermission('user-1', 'inventory', 'dispatch');
    expect(hasAccess).toBe(true);
    
    const noAccess = await service.hasPermission('user-1', 'inventory', 'view');
    expect(noAccess).toBe(false);
  });
});
