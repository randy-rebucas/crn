import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SAFE_USER_SELECT } from '../../common/prisma/safe-selects.js';
import { getScope } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateClassDto } from './dto/create-class.dto.js';

const INSTRUCTOR_INCLUDE = { instructor: { select: { id: true, user: { select: SAFE_USER_SELECT } } } };

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Same rule as AttendanceService's class scope: an ASSIGNED-scope
  // instructor only sees classes they teach, BRANCH only their branches.
  // Unlike that helper, any other scope fails closed (see branchScopeWhere)
  // instead of falling through to the whole organization.
  private async classScopeWhere(user: AuthenticatedUser, permissionKey: string) {
    const scope = getScope(user, permissionKey);
    if (scope === undefined || scope === 'ORGANIZATION' || scope === 'GLOBAL') return {};
    if (scope === 'BRANCH') return { branchId: { in: user.branchIds } };
    if (scope === 'ASSIGNED') {
      const instructor = await this.prisma.instructorProfile.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
        select: { id: true },
      });
      return { instructorProfileId: instructor?.id ?? '__no_instructor_profile__' };
    }
    throw new ForbiddenException(
      `"${permissionKey}" scope "${scope}" is not supported by this resource's authorization rule`,
    );
  }

  async findAll(user: AuthenticatedUser) {
    const scope = await this.classScopeWhere(user, 'classes.view');
    const classes = await this.prisma.class.findMany({
      where: { branch: { organizationId: user.organizationId }, ...scope },
      include: { course: true, batch: true, room: true, ...INSTRUCTOR_INCLUDE },
      orderBy: { createdAt: 'desc' },
    });

    // Headcount per class (students ENROLLED in its batch — the roster rule),
    // in one grouped query so the list page doesn't download every roster
    // just to count it. A count carries no names, so it rides on classes.view.
    const batchIds = [...new Set(classes.map((c) => c.batchId))];
    const counts = batchIds.length
      ? await this.prisma.enrollment.groupBy({
          by: ['batchId'],
          where: { batchId: { in: batchIds }, status: EnrollmentStatus.ENROLLED },
          _count: { _all: true },
        })
      : [];
    const byBatch = new Map(counts.map((c) => [c.batchId, c._count._all]));
    return classes.map((c) => ({ ...c, enrolledCount: byBatch.get(c.batchId) ?? 0 }));
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const scope = await this.classScopeWhere(user, 'classes.view');
    const cls = await this.prisma.class.findFirst({
      where: { id, branch: { organizationId: user.organizationId }, ...scope },
      include: {
        course: true,
        batch: true,
        room: true,
        ...INSTRUCTOR_INCLUDE,
        schedules: true,
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  // Previously there was no dedicated roster endpoint — the Attendance UI
  // had to fetch every enrollment and join it to a class's batch
  // client-side. A class's roster is "students ENROLLED in this class's
  // batch," which only the API can express as a single indexed query.
  // Scoped on attendance.view (the endpoint's permission), so an instructor
  // can't pull names/emails for another instructor's class by id.
  async roster(user: AuthenticatedUser, classId: string) {
    const scope = await this.classScopeWhere(user, 'attendance.view');
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, branch: { organizationId: user.organizationId }, ...scope },
      select: { batchId: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { batchId: cls.batchId, status: EnrollmentStatus.ENROLLED },
      include: { student: { select: { id: true, user: { select: SAFE_USER_SELECT } } } },
      orderBy: { createdAt: 'asc' },
    });

    return enrollments.map((e) => e.student);
  }

  async create(organizationId: string, actorId: string, dto: CreateClassDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const batch = await this.prisma.batch.findFirst({
      where: { id: dto.batchId, branch: { organizationId } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, program: { organizationId } },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, branch: { organizationId } },
      });
      if (!room) throw new NotFoundException('Room not found');
    }

    if (dto.instructorProfileId) {
      const instructor = await this.prisma.instructorProfile.findFirst({
        where: { id: dto.instructorProfileId, organizationId },
      });
      if (!instructor) throw new NotFoundException('Instructor not found');
    }

    const cls = await this.prisma.class.create({
      data: {
        batchId: dto.batchId,
        courseId: dto.courseId,
        branchId: dto.branchId,
        name: dto.name,
        instructorProfileId: dto.instructorProfileId,
        roomId: dto.roomId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'class.created',
      resource: 'class',
      resourceId: cls.id,
      afterState: cls,
    });

    return cls;
  }
}
