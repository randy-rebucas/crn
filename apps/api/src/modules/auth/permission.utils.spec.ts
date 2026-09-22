import { buildEffectivePermissions } from './permission.utils.js';

describe('buildEffectivePermissions', () => {
  it('keeps the broader scope when two roles grant the same permission at different scopes', () => {
    const userRoles = [
      {
        role: {
          key: 'instructor',
          permissions: [{ scope: 'ASSIGNED', permission: { key: 'students.view' } }],
        },
      },
      {
        role: {
          key: 'branch_manager',
          permissions: [{ scope: 'BRANCH', permission: { key: 'students.view' } }],
        },
      },
    ];

    const result = buildEffectivePermissions(userRoles);
    expect(result).toEqual([{ key: 'students.view', scope: 'BRANCH' }]);
  });

  it('GLOBAL beats every other scope regardless of grant order', () => {
    const userRoles = [
      {
        role: {
          key: 'super_admin',
          permissions: [{ scope: 'GLOBAL', permission: { key: 'exams.grade' } }],
        },
      },
      {
        role: {
          key: 'instructor',
          permissions: [{ scope: 'SELF', permission: { key: 'exams.grade' } }],
        },
      },
    ];

    expect(buildEffectivePermissions(userRoles)).toEqual([{ key: 'exams.grade', scope: 'GLOBAL' }]);
  });

  it('keeps distinct permission keys separate rather than merging them', () => {
    const userRoles = [
      {
        role: {
          key: 'instructor',
          permissions: [
            { scope: 'ASSIGNED', permission: { key: 'students.view' } },
            { scope: 'SELF', permission: { key: 'exams.view' } },
          ],
        },
      },
    ];

    expect(buildEffectivePermissions(userRoles)).toEqual([
      { key: 'students.view', scope: 'ASSIGNED' },
      { key: 'exams.view', scope: 'SELF' },
    ]);
  });

  it('returns an empty list for a user with no roles', () => {
    expect(buildEffectivePermissions([])).toEqual([]);
  });
});
