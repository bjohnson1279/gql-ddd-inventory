/**
 * PermissionService
 *
 * Domain service that resolves a user's effective permissions by loading
 * their assigned roles and the union of all role → permission mappings.
 */
import { IPermissionRepository } from '../repositories/IPermissionRepository';
import { Permission } from '../entities/Permission';

export class PermissionService {
  constructor(private readonly permissionRepo: IPermissionRepository) {}

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
    const permissions = await this.permissionRepo.findPermissionsByUserId(userId);

    // Compute the union of all permissions across all assigned roles
    const permissionSet = new Set<string>();
    for (const perm of permissions) {
      permissionSet.add(perm.key);
    }

    return Array.from(permissionSet);
  }

  /**
   * Returns the effective permission keys for a set of role IDs.
   * Used during login when we already have the role IDs from the UserRole join.
   */
  async getEffectivePermissionKeys(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];

    const permissions = await this.permissionRepo.findPermissionsByRoleIds(roleIds);

    const permissionSet = new Set<string>();
    for (const perm of permissions) {
      permissionSet.add(perm.key);
    }

    return Array.from(permissionSet);
  }

  /**
   * Returns full permission details (not just keys) for a user.
   * Used for the userEffectivePermissions query.
   */
  async getUserPermissions(userId: string): Promise<Array<{ id: string; resource: string; action: string; description: string }>> {
    const permissions = await this.permissionRepo.findPermissionsByUserId(userId);

    const permMap = new Map<string, { id: string; resource: string; action: string; description: string }>();
    for (const perm of permissions) {
      if (!permMap.has(perm.id)) {
        permMap.set(perm.id, {
          id: perm.id,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
        });
      }
    }

    return Array.from(permMap.values());
  }
}
