import { EnrollmentStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';
import { getScope } from './scope.js';

// Enrollments that grant access to a program's courses, library, and exams:
// the set the student portal treats as "active", plus COMPLETED so graduates
// keep their materials.
export const PROGRAM_ACCESS_ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  EnrollmentStatus.APPROVED,
  EnrollmentStatus.PAYMENT_PENDING,
  EnrollmentStatus.PAYMENT_VERIFIED,
  EnrollmentStatus.ENROLLED,
  EnrollmentStatus.COMPLETED,
];

// Program content (courses and everything under them, exams) is otherwise
// visible org-wide to anyone holding the view permission. A SELF-scoped
// holder — a student — may only reach programs they're enrolled in, so the
// portal's program filter isn't the only thing standing between a student
// and another program's exams.
//
// Returns the program ids to restrict to, or null when the caller isn't
// restricted (staff scopes). A student with no qualifying enrollment gets [].
export async function accessibleProgramIds(
  prisma: PrismaService,
  user: AuthenticatedUser,
  viewPermissionKey: string,
): Promise<string[] | null> {
  if (getScope(user, viewPermissionKey) !== 'SELF') return null;
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: { in: PROGRAM_ACCESS_ENROLLMENT_STATUSES },
      student: { userId: user.id, organizationId: user.organizationId },
    },
    select: { programId: true },
  });
  return [...new Set(enrollments.map((e) => e.programId))];
}

// `where` fragment for an Exam: an exam with no program is org-wide and
// stays open to everyone; a program's exam needs an enrollment in it.
export function examProgramWhere(programIds: string[] | null) {
  return programIds === null ? {} : { OR: [{ programId: null }, { programId: { in: programIds } }] };
}

// `where` fragment for a Program relation: the org check plus, for a
// restricted caller, the enrolled-program allowlist.
export function programWhere(organizationId: string, programIds: string[] | null) {
  return programIds === null ? { organizationId } : { organizationId, id: { in: programIds } };
}
