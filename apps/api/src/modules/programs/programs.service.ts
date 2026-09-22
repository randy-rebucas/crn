import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publishedOnlyWhere } from '../../common/authz/content-visibility.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateProgramDto } from './dto/create-program.dto.js';

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.program.findMany({
      where: { organizationId: user.organizationId, ...publishedOnlyWhere(user, 'programs.create') },
      include: { courses: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // `bypassVisibility` is for internal callers (setStatus below) that are
  // already permission-gated at the controller level and need to read a
  // program regardless of its current status.
  async findOne(organizationId: string, id: string, user?: AuthenticatedUser) {
    const program = await this.prisma.program.findFirst({
      where: {
        id,
        organizationId,
        ...(user ? publishedOnlyWhere(user, 'programs.create') : {}),
      },
      include: { courses: true, batches: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async create(organizationId: string, actorId: string, dto: CreateProgramDto) {
    const program = await this.prisma.program.create({
      data: { organizationId, name: dto.name, slug: dto.slug, description: dto.description },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'program.created',
      resource: 'program',
      resourceId: program.id,
      afterState: program,
    });

    return program;
  }

  async setStatus(organizationId: string, actorId: string, id: string, status: ContentStatus) {
    const before = await this.findOne(organizationId, id);

    const program = await this.prisma.program.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: `program.${status.toLowerCase()}`,
      resource: 'program',
      resourceId: id,
      beforeState: { status: before.status },
      afterState: { status: program.status },
    });

    return program;
  }
}
