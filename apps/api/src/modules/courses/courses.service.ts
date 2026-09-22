import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publishedOnlyWhere } from '../../common/authz/content-visibility.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateCourseDto } from './dto/create-course.dto.js';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForProgram(user: AuthenticatedUser, programId: string) {
    return this.prisma.course.findMany({
      where: {
        programId,
        program: { organizationId: user.organizationId },
        ...publishedOnlyWhere(user, 'courses.create'),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateCourseDto) {
    const program = await this.prisma.program.findFirst({
      where: { id: dto.programId, organizationId },
    });
    if (!program) throw new NotFoundException('Program not found');

    const course = await this.prisma.course.create({
      data: {
        programId: dto.programId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'course.created',
      resource: 'course',
      resourceId: course.id,
      afterState: course,
    });

    return course;
  }
}
