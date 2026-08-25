/**
 * PermissionService
 *
 * Domain service that resolves a user's effective permissions by loading
 * their assigned roles and the union of all role → permission mappings.
 */
import { PrismaClient } from '@prisma/client';

export class PermissionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Checks whether a user has a specific resource:action permission.
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const permissions = await this.getUserPermissionKeys(userId);
    return permissions.includes(`${resource}:${action}`);
  }

  /**
   * Returns all permission keys (resource:action) for a user as a flat string array.
   * This is the format embedded in JWT tokens.
   */
  async getUserPermissionKeys(userId: string): Promise<string[]> {
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

    // Compute the union of all permissions across all assigned roles
    const permissionSet = new Set<string>();
    for (const userRole of userRoles) {
      for (const rp of userRole.role.rolePermissions) {
        permissionSet.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }

    return Array.from(permissionSet);
  }

  /**
   * Returns the effective permission keys for a set of role IDs.
   * Used during login when we already have the role IDs from the UserRole join.
   */
  async getEffectivePermissionKeys(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true }
    });

    const permissionSet = new Set<string>();
    for (const rp of rolePermissions) {
      permissionSet.add(`${rp.permission.resource}:${rp.permission.action}`);
    }

    return Array.from(permissionSet);
  }

  /**
   * Returns full permission details (not just keys) for a user.
   * Used for the userEffectivePermissions query.
   */
  async getUserPermissions(userId: string): Promise<Array<{ id: string; resource: string; action: string; description: string }>> {
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

    const permMap = new Map<string, { id: string; resource: string; action: string; description: string }>();
    for (const userRole of userRoles) {
      for (const rp of userRole.role.rolePermissions) {
        if (!permMap.has(rp.permission.id)) {
          permMap.set(rp.permission.id, {
            id: rp.permission.id,
            resource: rp.permission.resource,
            action: rp.permission.action,
            description: rp.permission.description,
          });
        }
      }
    }

    return Array.from(permMap.values());
  }
}
