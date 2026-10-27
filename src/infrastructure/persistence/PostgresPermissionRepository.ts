import { PrismaClient } from '@prisma/client';
import { IPermissionRepository } from '../../domain/repositories/IPermissionRepository';
import { Permission } from '../../domain/entities/Permission';

export class PostgresPermissionRepository implements IPermissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPermissionsByUserId(userId: string): Promise<Permission[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
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

    const permissions: Permission[] = [];
    for (const userRole of userRoles) {
      for (const rp of userRole.role.rolePermissions) {
        permissions.push(
          new Permission(
            rp.permission.id,
            rp.permission.resource,
            rp.permission.action,
            rp.permission.description
          )
        );
      }
    }

    return permissions;
  }

  async findPermissionsByRoleIds(roleIds: string[]): Promise<Permission[]> {
    if (roleIds.length === 0) return [];

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true }
    });

    return rolePermissions.map(
      (rp) =>
        new Permission(
          rp.permission.id,
          rp.permission.resource,
          rp.permission.action,
          rp.permission.description
        )
    );
  }
}
