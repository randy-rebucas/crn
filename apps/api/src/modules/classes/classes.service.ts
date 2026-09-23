import { Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SAFE_USER_SELECT } from '../../common/prisma/safe-selects.js';
import type { CreateClassDto } from './dto/create-class.dto.js';

const INSTRUCTOR_INCLUDE = { instructor: { select: { id: true, user: { select: SAFE_USER_SELECT } } } };

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.class.findMany({
      where: { branch: { organizationId } },
      include: { course: true, batch: true, room: true, ...INSTRUCTOR_INCLUDE },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, branch: { organizationId } },
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
  async roster(organizationId: string, classId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, branch: { organizationId } },
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
