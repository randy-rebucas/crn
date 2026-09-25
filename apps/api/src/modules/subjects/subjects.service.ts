import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publishedOnlyWhere } from '../../common/authz/content-visibility.js';
import { accessibleProgramIds, programWhere } from '../../common/authz/program-access.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateSubjectDto } from './dto/create-subject.dto.js';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAllForCourse(user: AuthenticatedUser, courseId: string) {
    const programIds = await accessibleProgramIds(this.prisma, user, 'courses.view');
    return this.prisma.subject.findMany({
      where: {
        courseId,
        course: { program: programWhere(user.organizationId, programIds) },
        ...publishedOnlyWhere(user, 'courses.update'),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateSubjectDto) {
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, program: { organizationId } },
    });
    if (!course) throw new NotFoundException('Course not found');

    const subject = await this.prisma.subject.create({
      data: { courseId: dto.courseId, name: dto.name, description: dto.description },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'subject.created',
      resource: 'subject',
      resourceId: subject.id,
      afterState: subject,
    });

    return subject;
  }
}
