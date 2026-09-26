import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard.js';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';

function makeContext(user: AuthenticatedUser | undefined, requiredPermissions: string[] | undefined) {
  const reflector = {
    getAllAndOverride: () => requiredPermissions,
  } as unknown as Reflector;

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;

  return { reflector, context };
}

function makeUser(permissions: AuthenticatedUser['permissions']): AuthenticatedUser {
  return {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    branchIds: [],
    roles: [],
    permissions,
  };
}

describe('PermissionsGuard', () => {
  it('allows the request through when no permissions are required', () => {
    const { reflector, context } = makeContext(makeUser([]), undefined);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the user holds every required permission key', () => {
    const user = makeUser([{ key: 'students.view', scope: 'GLOBAL' }]);
    const { reflector, context } = makeContext(user, ['students.view']);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when the user is missing a required permission key', () => {
    const user = makeUser([{ key: 'students.view', scope: 'GLOBAL' }]);
    const { reflector, context } = makeContext(user, ['students.view', 'roles.manage']);
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user on the request at all', () => {
    const { reflector, context } = makeContext(undefined, ['students.view']);
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('does not treat holding the key at a narrow scope as insufficient — scope narrowing is the service layer\'s job', () => {
    const user = makeUser([{ key: 'students.view', scope: 'SELF' }]);
    const { reflector, context } = makeContext(user, ['students.view']);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
