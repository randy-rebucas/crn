import { accessibleProgramIds, examProgramWhere, programWhere } from './program-access.js';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'user@example.com',
    branchIds: ['branch-a'],
    roles: ['some_role'],
    permissions: [],
    ...overrides,
  };
}

function makePrisma(programIds: string[]) {
  const findMany = vi.fn().mockResolvedValue(programIds.map((programId) => ({ programId })));
  return { prisma: { enrollment: { findMany } } as unknown as PrismaService, findMany };
}

describe('accessibleProgramIds', () => {
  it('does not restrict staff scopes', async () => {
    const { prisma, findMany } = makePrisma(['p-1']);
    const user = makeUser({ permissions: [{ key: 'exams.view', scope: 'ORGANIZATION' }] });
    await expect(accessibleProgramIds(prisma, user, 'exams.view')).resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("restricts a SELF-scoped caller to their own enrollments' programs, deduplicated", async () => {
    const { prisma, findMany } = makePrisma(['p-1', 'p-2', 'p-1']);
    const user = makeUser({ permissions: [{ key: 'exams.view', scope: 'SELF' }] });
    await expect(accessibleProgramIds(prisma, user, 'exams.view')).resolves.toEqual(['p-1', 'p-2']);
    expect(findMany.mock.calls[0][0].where.student).toEqual({ userId: 'user-1', organizationId: 'org-1' });
  });

  it('gives a SELF-scoped caller with no qualifying enrollment an empty allowlist, not "no filter"', async () => {
    const { prisma } = makePrisma([]);
    const user = makeUser({ permissions: [{ key: 'courses.view', scope: 'SELF' }] });
    await expect(accessibleProgramIds(prisma, user, 'courses.view')).resolves.toEqual([]);
  });
});

describe('examProgramWhere', () => {
  it('adds nothing for an unrestricted caller', () => {
    expect(examProgramWhere(null)).toEqual({});
  });

  it('keeps org-wide exams (no program) open alongside enrolled programs', () => {
    expect(examProgramWhere(['p-1'])).toEqual({ OR: [{ programId: null }, { programId: { in: ['p-1'] } }] });
  });
});

describe('programWhere', () => {
  it('only checks the organization for an unrestricted caller', () => {
    expect(programWhere('org-1', null)).toEqual({ organizationId: 'org-1' });
  });

  it('adds the program allowlist for a restricted caller', () => {
    expect(programWhere('org-1', ['p-1'])).toEqual({ organizationId: 'org-1', id: { in: ['p-1'] } });
  });
});
