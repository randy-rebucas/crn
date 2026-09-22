import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marks a route as requiring the given permission key(s) (e.g. "students.view").
 * Actual scope narrowing (own/branch/assigned/etc.) happens per-resource in the
 * service layer via PermissionsService.getEffectiveScope(), never in the frontend.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
