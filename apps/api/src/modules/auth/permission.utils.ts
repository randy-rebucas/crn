import type { EffectivePermission } from './auth.types.js';

type RolePermissionRow = {
  role: {
    key: string;
    permissions: { scope: string; permission: { key: string } }[];
  };
};

/**
 * Flattens a user's role -> role_permission -> permission graph into a
 * de-duplicated list, keeping the broadest scope when the same permission
 * key is granted by more than one role (e.g. GLOBAL beats BRANCH beats SELF).
 */
export const SCOPE_RANK = [
  'SELF',
  'ASSIGNED',
  'CLASS',
  'COURSE',
  'PROGRAM',
  'DEPARTMENT',
  'BRANCH',
  'ORGANIZATION',
  'GLOBAL',
];

export function buildEffectivePermissions(userRoles: RolePermissionRow[]): EffectivePermission[] {
  const byKey = new Map<string, EffectivePermission>();

  for (const userRole of userRoles) {
    for (const rp of userRole.role.permissions) {
      const key = rp.permission.key;
      const existing = byKey.get(key);
      if (!existing || SCOPE_RANK.indexOf(rp.scope) > SCOPE_RANK.indexOf(existing.scope)) {
        byKey.set(key, { key, scope: rp.scope as EffectivePermission['scope'] });
      }
    }
  }

  return Array.from(byKey.values());
}
