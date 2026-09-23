import { ForbiddenException } from '@nestjs/common';
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
// that); BRANCH is restricted to the caller's own branches.
//
// Any other scope (SELF/ASSIGNED/CLASS/COURSE/PROGRAM/DEPARTMENT) has no
// generic branch-shaped meaning here — a resource-specific rule (see
// studentScopeWhere/enrollmentScopeWhere) should be used instead. This
// fails closed rather than falling back to "no filter": returning `{}` for
// a scope this helper doesn't understand was exactly the bug fixed in
// enrollmentScopeWhere (a SELF-scoped caller saw the whole organization).
// A custom role can grant e.g. `staff.view` at SELF scope through
// /v1/roles — if that ever happens, the service must be updated to use a
// resource-specific scope helper instead of silently exposing everyone.
export function branchScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { branchId: { in: user.branchIds } };
  if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
  throw new ForbiddenException(
    `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
  );
}

// Scope filter for a StudentProfile-shaped query: global/organization/unheld
// = no extra filter beyond the caller's org, branch = the caller's branches,
// self = only the caller's own profile. ASSIGNED (an instructor's own
// students) needs a DB lookup of the instructor's classes, so it can't be
// resolved by this sync helper — callers must check for it via `getScope`
// first and use a resource-specific async lookup (see StudentsService).
// Anything else fails closed rather than silently exposing the whole
// organization (same bug class as branchScopeWhere).
export function studentScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  switch (scope) {
    case undefined:
    case 'ORGANIZATION':
    case 'GLOBAL':
      return {};
    case 'BRANCH':
      return { branchId: { in: user.branchIds } };
    case 'SELF':
      return { userId: user.id };
    default:
      throw new ForbiddenException(
        `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
      );
  }
}

// Scope filter for the Payment model. Payment has no `branchId` column of
// its own — it reaches a branch only through `invoice.branchId` — so BRANCH
// narrows on that nested relation instead of a bare column. Financial
// visibility must be branch-specific (blueprint Section 8): a Finance
// Officer scoped to one branch must never see another branch's payments.
export function paymentScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { invoice: { branchId: { in: user.branchIds } } };
  if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
  throw new ForbiddenException(
    `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
  );
}

// Scope filter for the Refund model. Refund reaches its branch through
// `payment.invoice.branchId` — one hop further than Payment. Same
// branch-specific-financial-visibility rationale as `paymentScopeWhere`.
export function refundScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { payment: { invoice: { branchId: { in: user.branchIds } } } };
  if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
  throw new ForbiddenException(
    `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
  );
}

// Scope filter for the RequirementSubmission model (blueprint Section 11:
// the Requirements step). It reaches a branch/student through its
// `enrollment` relation, which already has its own `branchId` column and a
// `student.userId` for SELF — the applicant themselves.
export function requirementSubmissionScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { enrollment: { branchId: { in: user.branchIds } } };
  if (scope === 'SELF') return { enrollment: { student: { userId: user.id } } };
  if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
  throw new ForbiddenException(
    `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
  );
}

// Scope filter for the Certificate model. Certificate has no `branchId`
// column of its own — it reaches a branch only through `student.branchId` —
// so BRANCH narrows on that nested relation instead of a bare column.
export function certificateScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { student: { branchId: { in: user.branchIds } } };
  if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
  throw new ForbiddenException(
    `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
  );
}

// Scope filter for the Attempt model (exam attempts/grading). Attempt has no
// `branchId`/`organizationId` column of its own — it reaches both only
// through `student` — so BRANCH narrows on `student.branchId`. ASSIGNED (an
// instructor's own class) needs the same DB lookup as
// StudentsService.assignedStudentWhere, so it can't be resolved by this sync
// helper — callers must check for it via `getScope` and use a
// resource-specific async lookup instead.
export function attemptScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  if (scope === 'BRANCH') return { student: { branchId: { in: user.branchIds } } };
  if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
  throw new ForbiddenException(
    `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
  );
}

// Scope filter for the Enrollment model. Enrollment has its own `branchId`
// column (BRANCH narrows directly on it) but no `userId` — "self" means
// "belongs to my own StudentProfile", reached through the `student`
// relation. Unlike the original `branchScopeWhere`, this does NOT silently
// fall back to "no filter" for SELF — that was the bug (a SELF-scoped
// caller saw the whole organization's enrollments because `branchScopeWhere`
// only knew about BRANCH and returned `{}` for everything else). Any scope
// this helper doesn't have a rule for still fails closed, same as above.
export function enrollmentScopeWhere(user: AuthenticatedUser, permissionKey: string) {
  const scope = getScope(user, permissionKey);
  switch (scope) {
    case undefined:
    case 'ORGANIZATION':
    case 'GLOBAL':
      return {};
    case 'BRANCH':
      return { branchId: { in: user.branchIds } };
    case 'SELF':
      return { student: { userId: user.id } };
    default:
      throw new ForbiddenException(
        `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
      );
  }
}
