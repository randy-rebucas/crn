import { PermissionScope } from '@prisma/client';

export interface EffectivePermission {
  key: string; // e.g. "students.view"
  scope: PermissionScope;
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  branchIds: string[];
  roles: string[];
  permissions: EffectivePermission[];
}

export interface JwtAccessPayload {
  sub: string;
  organizationId: string;
  email: string;
}
