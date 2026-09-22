import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';

// Content (programs/courses/subjects/modules/lessons/materials/exams) moves
// through a Draft->Review->Approved->Published->Archived pipeline (blueprint
// Section 13). Anyone without the permission to manage that content type
// must only ever see PUBLISHED items — draft/unapproved content is not a
// visibility *scope* concern (SELF/BRANCH/etc.), it's a separate axis, so
// this sits alongside `scope.ts` rather than folding into it.
//
// `managePermissionKey` is the permission that marks someone as an author/
// reviewer for that content type (e.g. `courses.create`, `exams.update`) —
// holding it in ANY scope is enough to see non-published content, since the
// resource-level scope filters (organizationId, programId, etc.) already
// narrow which draft content they can reach.
export function publishedOnlyWhere(user: AuthenticatedUser, managePermissionKey: string) {
  const canManage = user.permissions.some((p) => p.key === managePermissionKey);
  return canManage ? {} : { status: 'PUBLISHED' as const };
}
