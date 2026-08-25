/**
 * ManageRoles Use Cases
 *
 * CRUD operations for roles and permissions management.
 */
import { PrismaClient } from '@prisma/client';

export class ManageRolesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates a custom role scoped to a specific tenant.
   */
  async createCustomRole(tenantId: string, name: string, description: string, permissionIds: string[]) {
    const id = `custom_${tenantId}_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

    // Validate all permission IDs exist
    const validPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } }
    });
    if (validPermissions.length !== permissionIds.length) {
      const valid = new Set(validPermissions.map(p => p.id));
      const invalid = permissionIds.filter(id => !valid.has(id));
      throw new Error(`Invalid permission IDs: ${invalid.join(', ')}`);
    }

    const role = await this.prisma.role.create({
      data: {
        id,
        name,
        description,
        isCustom: true,
        tenantId,
        rolePermissions: {
          create: permissionIds.map(permissionId => ({ permissionId }))
        }
      },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      }
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isCustom: role.isCustom,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      }))
    };
  }

  /**
   * Updates the permission set for an existing role.
   */
  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error(`Role '${roleId}' not found.`);

    // Replace all permission mappings
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({ roleId, permissionId })),
      skipDuplicates: true,
    });

    return this.getRole(roleId);
  }

  /**
   * Deletes a custom role. Prevents deletion if users are assigned.
   */
  async deleteCustomRole(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { userRoles: true }
    });
    if (!role) throw new Error(`Role '${roleId}' not found.`);
    if (!role.isCustom) throw new Error('Cannot delete a built-in system role.');
    if (role.userRoles.length > 0) {
      throw new Error(`Cannot delete role '${role.name}': ${role.userRoles.length} user(s) are currently assigned.`);
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.role.delete({ where: { id: roleId } });
    return true;
  }

  /**
   * Lists all roles available to a tenant (system roles + tenant custom roles).
   */
  async listRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          { isCustom: false },           // System roles
          { tenantId },                   // Tenant-specific custom roles
        ]
      },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isCustom: role.isCustom,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      }))
    }));
  }

  /**
   * Lists all permissions in the catalog.
   */
  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }]
    });
  }

  /**
   * Assigns multiple roles to a user (additive).
   */
  async assignRolesToUser(userId: string, roleIds: string[]) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error(`User '${userId}' not found.`);

    // Validate all role IDs exist
    const validRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } }
    });
    if (validRoles.length !== roleIds.length) {
      const valid = new Set(validRoles.map(r => r.id));
      const invalid = roleIds.filter(id => !valid.has(id));
      throw new Error(`Invalid role IDs: ${invalid.join(', ')}`);
    }

    await this.prisma.userRole.createMany({
      data: roleIds.map(roleId => ({ userId, roleId })),
      skipDuplicates: true,
    });

    return true;
  }

  /**
   * Removes specific roles from a user.
   */
  async removeRolesFromUser(userId: string, roleIds: string[]) {
    await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: { in: roleIds }
      }
    });
    return true;
  }

  /**
   * Returns the effective permissions for a user (union across all roles).
   */
  async getUserEffectivePermissions(userId: string) {
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
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
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

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getRole(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      }
    });
    if (!role) throw new Error(`Role '${roleId}' not found.`);
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isCustom: role.isCustom,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      }))
    };
  }
}
