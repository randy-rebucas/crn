import { unlink } from 'fs/promises';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RequirementSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { requirementSubmissionScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateRequirementDto } from './dto/create-requirement.dto.js';
import type { ReviewSubmissionDto } from './dto/review-submission.dto.js';

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Requirement templates are org-wide catalog data (like Programs/Courses),
  // not scoped by branch — every branch runs the same admissions checklist
  // unless a program-specific override applies.
  listTemplates(organizationId: string, programId?: string) {
    return this.prisma.requirement.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(programId ? { OR: [{ programId }, { programId: null }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTemplate(organizationId: string, actorId: string, dto: CreateRequirementDto) {
    if (dto.programId) {
      const program = await this.prisma.program.findFirst({
        where: { id: dto.programId, organizationId },
      });
      if (!program) throw new NotFoundException('Program not found');
    }

    const requirement = await this.prisma.requirement.create({
      data: {
        organizationId,
        programId: dto.programId,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'requirement.created',
      resource: 'requirement',
      resourceId: requirement.id,
      afterState: requirement,
    });

    return requirement;
  }

  // Confirms the caller can reach this enrollment at all, using the same
  // scope as requirement submissions (BRANCH/SELF) rather than duplicating
  // enrollments.view's scope — a caller who can review requirements for a
  // branch should be able to see its enrollments' checklists even if they
  // don't separately hold enrollments.view.
  private async loadScopedEnrollment(user: AuthenticatedUser, enrollmentId: string, permissionKey: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        student: { organizationId: user.organizationId },
        ...(requirementSubmissionScopeWhere(user, permissionKey).enrollment ?? {}),
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  // Lists this enrollment's requirement checklist, auto-provisioning a
  // PENDING submission row for any active template (org-wide or matching
  // this enrollment's program) that doesn't have one yet — callers only
  // ever deal with "submit against requirementId X", never with manually
  // syncing the checklist to newly added templates.
  async listForEnrollment(user: AuthenticatedUser, enrollmentId: string) {
    const enrollment = await this.loadScopedEnrollment(user, enrollmentId, 'requirements.view');

    const templates = await this.prisma.requirement.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        OR: [{ programId: enrollment.programId }, { programId: null }],
      },
    });

    if (templates.length > 0) {
      await this.prisma.requirementSubmission.createMany({
        data: templates.map((t) => ({ enrollmentId, requirementId: t.id })),
        skipDuplicates: true,
      });
    }

    return this.prisma.requirementSubmission.findMany({
      where: { enrollmentId },
      include: { requirement: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async submitFile(
    user: AuthenticatedUser,
    enrollmentId: string,
    requirementId: string,
    file: { originalname: string; path: string; mimetype: string; size: number },
  ) {
    const enrollment = await this.loadScopedEnrollment(user, enrollmentId, 'requirements.submit');

    const requirement = await this.prisma.requirement.findFirst({
      where: {
        id: requirementId,
        organizationId: user.organizationId,
        OR: [{ programId: enrollment.programId }, { programId: null }],
      },
    });
    if (!requirement) throw new NotFoundException('Requirement not found for this enrollment');

    const existing = await this.prisma.requirementSubmission.findUnique({
      where: { enrollmentId_requirementId: { enrollmentId, requirementId } },
    });

    const submission = await this.prisma.requirementSubmission.upsert({
      where: { enrollmentId_requirementId: { enrollmentId, requirementId } },
      update: {
        status: RequirementSubmissionStatus.SUBMITTED,
        fileName: file.originalname,
        filePath: file.path,
        fileMimeType: file.mimetype,
        fileSizeBytes: file.size,
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: null,
      },
      create: {
        enrollmentId,
        requirementId,
        status: RequirementSubmissionStatus.SUBMITTED,
        fileName: file.originalname,
        filePath: file.path,
        fileMimeType: file.mimetype,
        fileSizeBytes: file.size,
        submittedAt: new Date(),
      },
    });

    // A re-submission replaces the previous file on disk (already
    // superseded in the DB by the upsert above) — otherwise every re-upload
    // permanently orphans the last one.
    if (existing?.filePath && existing.filePath !== file.path) {
      await unlink(existing.filePath).catch(() => undefined);
    }

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'requirement_submission.submitted',
      resource: 'requirement_submission',
      resourceId: submission.id,
      afterState: { status: submission.status, fileName: submission.fileName },
    });

    return submission;
  }

  async review(user: AuthenticatedUser, submissionId: string, dto: ReviewSubmissionDto) {
    const submission = await this.prisma.requirementSubmission.findFirst({
      where: {
        id: submissionId,
        enrollment: { student: { organizationId: user.organizationId } },
        ...requirementSubmissionScopeWhere(user, 'requirements.review'),
      },
    });
    if (!submission) throw new NotFoundException('Requirement submission not found');
    if (submission.status !== RequirementSubmissionStatus.SUBMITTED) {
      throw new BadRequestException(
        `Only a SUBMITTED requirement can be reviewed (this one is ${submission.status})`,
      );
    }

    const nextStatus =
      dto.decision === 'APPROVED' ? RequirementSubmissionStatus.APPROVED : RequirementSubmissionStatus.REJECTED;

    const updated = await this.prisma.requirementSubmission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: dto.notes,
      },
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `requirement_submission.${nextStatus.toLowerCase()}`,
      resource: 'requirement_submission',
      resourceId: submissionId,
      beforeState: { status: submission.status },
      afterState: { status: updated.status },
    });

    return updated;
  }

  // Returns the on-disk file path for a scoped download — the controller
  // streams it, this only proves the caller is allowed to see it.
  async getFileForDownload(user: AuthenticatedUser, submissionId: string) {
    const submission = await this.prisma.requirementSubmission.findFirst({
      where: {
        id: submissionId,
        enrollment: { student: { organizationId: user.organizationId } },
        ...requirementSubmissionScopeWhere(user, 'requirements.view'),
      },
    });
    if (!submission || !submission.filePath) throw new NotFoundException('File not found');
    return submission;
  }
}
