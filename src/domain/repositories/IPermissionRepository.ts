import { Permission } from '../entities/Permission';

export interface IPermissionRepository {
  findPermissionsByUserId(userId: string): Promise<Permission[]>;
  findPermissionsByRoleIds(roleIds: string[]): Promise<Permission[]>;
}
