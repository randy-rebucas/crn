import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttemptStatus, AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { getScope } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// Progress is a read layer over enrollments/attempts/attendance (same
// posture as ReportsService) — there's no lesson-completion tracking in
// the schema yet, so "progress" here means exam performance + attendance
// per program, not a content-completion percentage.
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async forCurrentStudent(user: AuthenticatedUser) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
    });
    if (!profile) throw new NotFoundException('No student profile for this account');
    return this.computeForStudent(user.organizationId, profile.id);
  }

  // Same scope-leak shape as AttendanceService.findAllForStudent: a
  // caller-supplied studentId must be checked against the resolved scope,
  // not trusted just because a permission key matched.
  async forStudent(user: AuthenticatedUser, studentId: string) {
    const scope = getScope(user, 'progress.view');
    if (scope === 'SELF') {
      const own = await this.prisma.studentProfile.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      if (!own || own.id !== studentId) {
        throw new ForbiddenException('You can only view your own progress');
      }
    } else if (scope === 'BRANCH') {
      const student = await this.prisma.studentProfile.findFirst({
        where: { id: studentId, organizationId: user.organizationId },
      });
      if (!student || !student.branchId || !user.branchIds.includes(student.branchId)) {
        throw new ForbiddenException('This student is outside your branch');
      }
    }

    return this.computeForStudent(user.organizationId, studentId);
  }

  private async computeForStudent(organizationId: string, studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, student: { organizationId } },
      include: { program: { select: { id: true, name: true } } },
    });

    const programs = await Promise.all(
      enrollments.map(async (enrollment) => {
        const [attempts, attendances] = await Promise.all([
          this.prisma.attempt.findMany({
            where: {
              studentId,
              status: AttemptStatus.GRADED,
              exam: { programId: enrollment.programId },
            },
            select: { score: true, maxScore: true, passed: true },
          }),
          this.prisma.attendance.findMany({
            where: { studentId, class: { batch: { programId: enrollment.programId } } },
            select: { status: true },
          }),
        ]);

        const gradedCount = attempts.length;
        const averageScorePct =
          gradedCount === 0
            ? null
            : Math.round(
                (attempts.reduce((sum, a) => sum + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) /
                  gradedCount) *
                  1000,
              ) / 10;
        const passRate =
          gradedCount === 0 ? null : Math.round((attempts.filter((a) => a.passed).length / gradedCount) * 1000) / 10;

        const totalSessions = attendances.length;
        const present = attendances.filter((a) => a.status === AttendanceStatus.PRESENT).length;
        const attendanceRate = totalSessions === 0 ? null : Math.round((present / totalSessions) * 1000) / 10;

        return {
          enrollmentId: enrollment.id,
          programId: enrollment.programId,
          programName: enrollment.program.name,
          enrollmentStatus: enrollment.status,
          exams: { graded: gradedCount, averageScorePct, passRate },
          attendance: { totalSessions, present, attendanceRate },
        };
      }),
    );

    const withScores = programs.filter((p) => p.exams.averageScorePct !== null);
    const withAttendance = programs.filter((p) => p.attendance.attendanceRate !== null);

    return {
      studentId,
      programs,
      overall: {
        averageScorePct:
          withScores.length === 0
            ? null
            : Math.round(
                (withScores.reduce((sum, p) => sum + (p.exams.averageScorePct ?? 0), 0) / withScores.length) * 10,
              ) / 10,
        attendanceRate:
          withAttendance.length === 0
            ? null
            : Math.round(
                (withAttendance.reduce((sum, p) => sum + (p.attendance.attendanceRate ?? 0), 0) /
                  withAttendance.length) *
                  10,
              ) / 10,
      },
    };
  }
}
