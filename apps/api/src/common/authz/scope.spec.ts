import { branchScopeWhere, getScope, studentScopeWhere } from './scope.js';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'user@example.com',
    branchIds: ['branch-a', 'branch-b'],
    roles: ['some_role'],
    permissions: [],
    ...overrides,
  };
}

describe('getScope', () => {
  it('returns the scope for a granted permission key', () => {
    const user = makeUser({ permissions: [{ key: 'students.view', scope: 'BRANCH' }] });
    expect(getScope(user, 'students.view')).toBe('BRANCH');
  });

  it('returns undefined for a permission the user does not hold', () => {
    const user = makeUser({ permissions: [] });
    expect(getScope(user, 'students.view')).toBeUndefined();
  });
});

describe('branchScopeWhere', () => {
  it('restricts to the caller\'s own branches when scope is BRANCH', () => {
    const user = makeUser({ permissions: [{ key: 'enrollments.view', scope: 'BRANCH' }] });
    expect(branchScopeWhere(user, 'enrollments.view')).toEqual({
      branchId: { in: ['branch-a', 'branch-b'] },
    });
  });

  it('adds no filter for GLOBAL scope, relying on the organization filter elsewhere', () => {
    const user = makeUser({ permissions: [{ key: 'enrollments.view', scope: 'GLOBAL' }] });
    expect(branchScopeWhere(user, 'enrollments.view')).toEqual({});
  });

  it('adds no filter when the permission is not held at all (guard already blocked the request)', () => {
    const user = makeUser({ permissions: [] });
    expect(branchScopeWhere(user, 'enrollments.view')).toEqual({});
  });
});

describe('studentScopeWhere', () => {
  it('restricts to the caller\'s own profile when scope is SELF', () => {
    const user = makeUser({ permissions: [{ key: 'students.view', scope: 'SELF' }] });
    expect(studentScopeWhere(user, 'students.view')).toEqual({ userId: 'user-1' });
  });

  it('restricts to the caller\'s branches when scope is BRANCH', () => {
    const user = makeUser({ permissions: [{ key: 'students.view', scope: 'BRANCH' }] });
    expect(studentScopeWhere(user, 'students.view')).toEqual({
      branchId: { in: ['branch-a', 'branch-b'] },
    });
  });

  it('adds no filter for ORGANIZATION or GLOBAL scope', () => {
    const globalUser = makeUser({ permissions: [{ key: 'students.view', scope: 'GLOBAL' }] });
    const orgUser = makeUser({ permissions: [{ key: 'students.view', scope: 'ORGANIZATION' }] });
    expect(studentScopeWhere(globalUser, 'students.view')).toEqual({});
    expect(studentScopeWhere(orgUser, 'students.view')).toEqual({});
  });
});
