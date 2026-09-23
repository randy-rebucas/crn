import { Injectable, NotFoundException } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SAFE_USER_SELECT } from '../../common/prisma/safe-selects.js';
import { attemptScopeWhere, getScope } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// Per-answer grading itself already lives on AttemptsService
// (`gradeAnswer`) — this module is the missing read side: a gradebook
// view per exam for instructors, and a rolled-up view per student. Not a
// duplicate grading path, just aggregation over the same Attempt rows.
@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  // Mirrors AttemptsService.resolveGradeScopeWhere: `exams.grade` at
  // ASSIGNED scope needs the instructor-profile-to-class DB lookup, so it
  // can't be resolved by the sync `attemptScopeWhere` helper alone.
  private async resolveGradeScopeWhere(user: AuthenticatedUser) {
    if (getScope(user, 'exams.grade') === 'ASSIGNED') {
      const instructor = await this.prisma.instructorProfile.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      const instructorProfileId = instructor?.id ?? '__no_instructor_profile__';
      return {
        student: { enrollments: { some: { batch: { classes: { some: { instructorProfileId } } } } } },
      };
    }
    return attemptScopeWhere(user, 'exams.grade');
  }

  async forExam(user: AuthenticatedUser, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, organizationId: user.organizationId },
      select: { id: true, title: true, passingScore: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const attempts = await this.prisma.attempt.findMany({
      where: { examId, ...(await this.resolveGradeScopeWhere(user)) },
      include: { student: { select: { id: true, user: { select: SAFE_USER_SELECT } } } },
      orderBy: { submittedAt: 'desc' },
    });

    const graded = attempts.filter((a) => a.status === AttemptStatus.GRADED);
    const averageScorePct =
      graded.length === 0
        ? null
        : Math.round(
            (graded.reduce((sum, a) => sum + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) / graded.length) *
              1000,
          ) / 10;
    const passRate =
      graded.length === 0 ? null : Math.round((graded.filter((a) => a.passed).length / graded.length) * 1000) / 10;

    return {
      exam,
      summary: { totalAttempts: attempts.length, graded: graded.length, averageScorePct, passRate },
      rows: attempts.map((a) => ({
        attemptId: a.id,
        studentId: a.studentId,
        studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
        status: a.status,
        score: a.score,
        maxScore: a.maxScore,
        passed: a.passed,
        submittedAt: a.submittedAt,
        gradedAt: a.gradedAt,
      })),
    };
  }

  async forCurrentStudent(organizationId: string, userId: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId, organizationId },
    });
    if (!profile) throw new NotFoundException('No student profile for this account');

    const attempts = await this.prisma.attempt.findMany({
      where: { studentId: profile.id, status: AttemptStatus.GRADED },
      include: { exam: { select: { id: true, title: true, type: true, passingScore: true } } },
      orderBy: { gradedAt: 'desc' },
    });

    const averageScorePct =
      attempts.length === 0
        ? null
        : Math.round(
            (attempts.reduce((sum, a) => sum + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) /
              attempts.length) *
              1000,
          ) / 10;

    return {
      summary: { graded: attempts.length, averageScorePct },
      grades: attempts.map((a) => ({
        attemptId: a.id,
        examId: a.examId,
        examTitle: a.exam.title,
        examType: a.exam.type,
        score: a.score,
        maxScore: a.maxScore,
        passed: a.passed,
        gradedAt: a.gradedAt,
      })),
    };
  }
}
