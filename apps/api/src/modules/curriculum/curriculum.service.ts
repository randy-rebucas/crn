import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, MaterialType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publishedOnlyWhere } from '../../common/authz/content-visibility.js';
import {
  PROGRAM_ACCESS_ENROLLMENT_STATUSES,
  accessibleProgramIds,
  programWhere,
} from '../../common/authz/program-access.js';
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

export const MATERIAL_TYPES = Object.values(MaterialType);

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Modules -------------------------------------------------------------

  async findModulesForSubject(user: AuthenticatedUser, subjectId: string) {
    const programIds = await accessibleProgramIds(this.prisma, user, 'courses.view');
    return this.prisma.module.findMany({
      where: {
        subjectId,
        subject: { course: { program: programWhere(user.organizationId, programIds) } },
        ...publishedOnlyWhere(user, 'courses.update'),
      },
      orderBy: { position: 'asc' },
    });
  }

  // A subject's whole module > lesson > material tree in one query, with the
  // same published-only rule applied at every level as the per-level
  // endpoints — the curriculum page previously walked it one request per
  // module and per lesson.
  async findOutlineForSubject(user: AuthenticatedUser, subjectId: string) {
    const programIds = await accessibleProgramIds(this.prisma, user, 'courses.view');
    const visible = publishedOnlyWhere(user, 'courses.update');
    return this.prisma.module.findMany({
      where: {
        subjectId,
        subject: { course: { program: programWhere(user.organizationId, programIds) } },
        ...visible,
      },
      include: {
        lessons: {
          where: visible,
          orderBy: { position: 'asc' },
          include: { materials: { where: visible, orderBy: { position: 'asc' } } },
        },
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

  async findLessonsForModule(user: AuthenticatedUser, moduleId: string) {
    const programIds = await accessibleProgramIds(this.prisma, user, 'courses.view');
    return this.prisma.lesson.findMany({
      where: {
        moduleId,
        module: { subject: { course: { program: programWhere(user.organizationId, programIds) } } },
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

  async findMaterialsForLesson(user: AuthenticatedUser, lessonId: string) {
    const programIds = await accessibleProgramIds(this.prisma, user, 'courses.view');
    return this.prisma.material.findMany({
      where: {
        lessonId,
        lesson: { module: { subject: { course: { program: programWhere(user.organizationId, programIds) } } } },
        ...publishedOnlyWhere(user, 'courses.update'),
      },
      orderBy: { position: 'asc' },
    });
  }

  // A student's library across every program they're enrolled in, flattened
  // out of the course > subject > module > lesson tree so the student portal
  // can list e.g. all videos without walking four levels of requests. Every
  // level must be PUBLISHED — a published material under a draft lesson is
  // still hidden. Callers without a student profile get an empty list.
  async findMyMaterials(user: AuthenticatedUser, types: MaterialType[]) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!profile) return [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: profile.id, status: { in: PROGRAM_ACCESS_ENROLLMENT_STATUSES } },
      select: { programId: true },
    });
    const programIds = [...new Set(enrollments.map((e) => e.programId))];
    if (programIds.length === 0) return [];

    const materials = await this.prisma.material.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        ...(types.length > 0 ? { type: { in: types } } : {}),
        lesson: {
          status: ContentStatus.PUBLISHED,
          module: {
            status: ContentStatus.PUBLISHED,
            subject: {
              status: ContentStatus.PUBLISHED,
              course: {
                status: ContentStatus.PUBLISHED,
                programId: { in: programIds },
                program: { organizationId: user.organizationId },
              },
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        position: true,
        updatedAt: true,
        lesson: {
          select: {
            id: true,
            name: true,
            position: true,
            module: {
              select: {
                id: true,
                name: true,
                position: true,
                subject: {
                  select: { id: true, name: true, course: { select: { id: true, name: true, code: true } } },
                },
              },
            },
          },
        },
      },
    });

    // Curriculum order: course code, subject, module, lesson, then material.
    return materials.sort((a, b) => {
      const am = a.lesson.module;
      const bm = b.lesson.module;
      return (
        am.subject.course.code.localeCompare(bm.subject.course.code) ||
        am.subject.name.localeCompare(bm.subject.name) ||
        am.position - bm.position ||
        a.lesson.position - b.lesson.position ||
        a.position - b.position
      );
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
