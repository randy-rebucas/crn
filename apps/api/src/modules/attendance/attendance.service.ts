import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SAFE_USER_SELECT } from '../../common/prisma/safe-selects.js';
import { getScope } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ASSIGNED scope (blueprint Section 7's own example: an instructor sees
  // attendance.view only for their assigned classes) needs a DB lookup —
  // the caller's InstructorProfile id — so it can't be a pure sync helper
  // like the branch/self scopes elsewhere.
  private async classScopeWhere(user: AuthenticatedUser, permissionKey: string) {
    const scope = getScope(user, permissionKey);
    if (scope === 'BRANCH') return { branch: { id: { in: user.branchIds } } };
    if (scope === 'ASSIGNED') {
      const instructor = await this.prisma.instructorProfile.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      // No instructor profile = assigned to nothing; match no class rather
      // than accidentally falling through to "see everything".
      return { instructorProfileId: instructor?.id ?? '__no_instructor_profile__' };
    }
    return {};
  }

  async findAllForClass(user: AuthenticatedUser, classId: string) {
    const classScope = await this.classScopeWhere(user, 'attendance.view');
    return this.prisma.attendance.findMany({
      where: { classId, class: { branch: { organizationId: user.organizationId }, ...classScope } },
      include: {
        student: { select: { id: true, user: { select: SAFE_USER_SELECT } } },
      },
      orderBy: { date: 'desc' },
    });
  }

  // `studentId` is caller-supplied via a query param, so a SELF-scoped
  // caller (a student) must be blocked from passing someone else's id —
  // same bug class as the enrollments SELF-scope leak: don't let a scope
  // that means "only your own records" silently become "no filter" just
  // because the caller controls the filter value.
  async findAllForStudent(user: AuthenticatedUser, studentId: string) {
    const scope = getScope(user, 'attendance.view');
    if (scope === 'SELF') {
      const own = await this.prisma.studentProfile.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      if (!own || own.id !== studentId) {
        throw new ForbiddenException('You can only view your own attendance');
      }
    } else if (scope === 'BRANCH') {
      const student = await this.prisma.studentProfile.findFirst({
        where: { id: studentId, organizationId: user.organizationId },
      });
      if (!student || !student.branchId || !user.branchIds.includes(student.branchId)) {
        throw new ForbiddenException('This student is outside your branch');
      }
    }

    return this.prisma.attendance.findMany({
      where: { studentId, student: { organizationId: user.organizationId } },
      include: { class: { include: { course: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async mark(user: AuthenticatedUser, dto: MarkAttendanceDto) {
    const organizationId = user.organizationId;
    const actorId = user.id;
    const classScope = await this.classScopeWhere(user, 'attendance.create');

    const [student, cls] = await Promise.all([
      this.prisma.studentProfile.findFirst({ where: { id: dto.studentId, organizationId } }),
      this.prisma.class.findFirst({ where: { id: dto.classId, branch: { organizationId } } }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!cls) throw new NotFoundException('Class not found');

    // Re-check the class against scope explicitly (rather than folding
    // classScope into the query above) so an out-of-scope class reports
    // as a permission error, not a confusing "not found".
    if ('instructorProfileId' in classScope && cls.instructorProfileId !== classScope.instructorProfileId) {
      throw new ForbiddenException('This class is not assigned to you');
    }
    if ('branch' in classScope) {
      const allowedBranchIds = (classScope.branch as { id: { in: string[] } }).id.in;
      if (!allowedBranchIds.includes(cls.branchId)) {
        throw new ForbiddenException('This class is outside your branch');
      }
    }

    const date = new Date(dto.date);

    const attendance = await this.prisma.attendance.upsert({
      where: { studentId_classId_date: { studentId: dto.studentId, classId: dto.classId, date } },
      update: { status: dto.status, markedById: actorId },
      create: {
        studentId: dto.studentId,
        classId: dto.classId,
        date,
        status: dto.status,
        markedById: actorId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'attendance.marked',
      resource: 'attendance',
      resourceId: attendance.id,
      afterState: attendance,
    });

    return attendance;
  }
}
