import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';

// Resolves the widest scope a user's roles grant for a given permission key.
// `buildEffectivePermissions` already picked the broadest scope across all
// of a user's roles, so this is just a lookup (blueprint Section 5/7).
export function getScope(user: AuthenticatedUser, permissionKey: string) {
  return user.permissions.find((p) => p.key === permissionKey)?.scope;
}

// Narrows a query on a branch-scoped resource (has a `branchId` column)
// by the caller's resolved scope for `permissionKey`. GLOBAL/ORGANIZATION
// see everything in the org (existing organizationId filter already limits
// that); BRANCH is restricted to the caller's own branches; SELF/ASSIGNED
// have no generic branch-shaped meaning here and fall back to nothing
// matching, since a resource-specific rule (see studentScopeWhere) should
// be used instead for those scopes.
export function branchScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { branchId: { in: user.branchIds } };
  return {};
}

// Scope filter for a StudentProfile-shaped query: global/organization = no
// extra filter beyond the caller's org, branch = the caller's branches,
// self = only the caller's own profile. ASSIGNED (an instructor's own
// students) is resolved by the caller via `assignedStudentWhere` below,
// since "assigned" depends on which classes the instructor teaches.
export function studentScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  switch (scope) {
    case 'BRANCH':
      return { branchId: { in: user.branchIds } };
    case 'SELF':
      return { userId: user.id };
    default:
      return {};
  }
}

// Scope filter for the Enrollment model. Enrollment has its own `branchId`
// column (BRANCH narrows directly on it) but no `userId` — "self" means
// "belongs to my own StudentProfile", reached through the `student`
// relation. Unlike `branchScopeWhere`, this does NOT silently fall back to
// "no filter" for SELF — that was the bug (a SELF-scoped caller saw the
// whole organization's enrollments because `branchScopeWhere` only knows
// about BRANCH and returns `{}` for everything else).
export function enrollmentScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  switch (scope) {
    case 'BRANCH':
      return { branchId: { in: user.branchIds } };
    case 'SELF':
      return { student: { userId: user.id } };
    default:
      return {};
  }
}
