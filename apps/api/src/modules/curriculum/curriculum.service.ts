import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publishedOnlyWhere } from '../../common/authz/content-visibility.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateModuleDto } from './dto/create-module.dto.js';
import type { CreateLessonDto } from './dto/create-lesson.dto.js';
import type { CreateMaterialDto } from './dto/create-material.dto.js';

// Content status pipeline shared by Module/Lesson/Material (blueprint Section 13):
// Draft -> Review -> Approved -> Published -> Archived.
const ALLOWED_CONTENT_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: [ContentStatus.REVIEW],
  REVIEW: [ContentStatus.APPROVED, ContentStatus.DRAFT],
  APPROVED: [ContentStatus.PUBLISHED, ContentStatus.REVIEW],
  PUBLISHED: [ContentStatus.ARCHIVED],
  ARCHIVED: [],
};

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Modules -------------------------------------------------------------

  findModulesForSubject(user: AuthenticatedUser, subjectId: string) {
    return this.prisma.module.findMany({
      where: {
        subjectId,
        subject: { course: { program: { organizationId: user.organizationId } } },
        ...publishedOnlyWhere(user, 'courses.update'),
      },
      orderBy: { position: 'asc' },
    });
  }

  async createModule(organizationId: string, actorId: string, dto: CreateModuleDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, course: { program: { organizationId } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const created = await this.prisma.module.create({
      data: { subjectId: dto.subjectId, name: dto.name, position: dto.position ?? 0 },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'module.created',
      resource: 'module',
      resourceId: created.id,
      afterState: created,
    });
    return created;
  }

  // --- Lessons ---------------------------------------------------------------

  findLessonsForModule(user: AuthenticatedUser, moduleId: string) {
    return this.prisma.lesson.findMany({
      where: {
        moduleId,
        module: { subject: { course: { program: { organizationId: user.organizationId } } } },
        ...publishedOnlyWhere(user, 'courses.update'),
      },
      orderBy: { position: 'asc' },
    });
  }

  async createLesson(organizationId: string, actorId: string, dto: CreateLessonDto) {
    const mod = await this.prisma.module.findFirst({
      where: { id: dto.moduleId, subject: { course: { program: { organizationId } } } },
    });
    if (!mod) throw new NotFoundException('Module not found');

    const created = await this.prisma.lesson.create({
      data: { moduleId: dto.moduleId, name: dto.name, position: dto.position ?? 0 },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'lesson.created',
      resource: 'lesson',
      resourceId: created.id,
      afterState: created,
    });
    return created;
  }

  // --- Materials -------------------------------------------------------------

  findMaterialsForLesson(user: AuthenticatedUser, lessonId: string) {
    return this.prisma.material.findMany({
      where: {
        lessonId,
        lesson: { module: { subject: { course: { program: { organizationId: user.organizationId } } } } },
        ...publishedOnlyWhere(user, 'courses.update'),
      },
      orderBy: { position: 'asc' },
    });
  }

  async createMaterial(organizationId: string, actorId: string, dto: CreateMaterialDto) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: dto.lessonId, module: { subject: { course: { program: { organizationId } } } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const created = await this.prisma.material.create({
      data: {
        lessonId: dto.lessonId,
        title: dto.title,
        type: dto.type,
        content: dto.content,
        position: dto.position ?? 0,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'material.created',
      resource: 'material',
      resourceId: created.id,
      afterState: created,
    });
    return created;
  }

  // --- Shared status pipeline --------------------------------------------

  async setStatus(
    resource: 'module' | 'lesson' | 'material',
    organizationId: string,
    actorId: string,
    id: string,
    nextStatus: ContentStatus,
  ) {
    const delegate =
      resource === 'module' ? this.prisma.module : resource === 'lesson' ? this.prisma.lesson : this.prisma.material;

    const scopeWhere =
      resource === 'module'
        ? { subject: { course: { program: { organizationId } } } }
        : resource === 'lesson'
          ? { module: { subject: { course: { program: { organizationId } } } } }
          : { lesson: { module: { subject: { course: { program: { organizationId } } } } } };

    const existing = await (delegate as any).findFirst({ where: { id, ...scopeWhere } });
    if (!existing) throw new NotFoundException(`${resource} not found`);

    const allowed = ALLOWED_CONTENT_TRANSITIONS[existing.status as ContentStatus];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot move ${resource} from ${existing.status} to ${nextStatus}`,
      );
    }

    const updated = await (delegate as any).update({ where: { id }, data: { status: nextStatus } });

    await this.audit.log({
      organizationId,
      actorId,
      action: `${resource}.${nextStatus.toLowerCase()}`,
      resource,
      resourceId: id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status },
    });

    return updated;
  }
}
