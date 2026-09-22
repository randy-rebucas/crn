import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdmissionStatus, LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadsService } from '../leads/leads.service.js';
import { branchScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateAdmissionDto } from './dto/create-admission.dto.js';
import type { ReviewAdmissionDto } from './dto/review-admission.dto.js';

// The decision step LeadStatus's APPLICATION/APPLICANT stages implied but
// never had a record for: reviewing an application and approving or
// rejecting it. Approving here also drives the Lead through its existing
// APPLICATION -> APPLICANT transition (LEAD_TRANSITIONS in leads module) —
// this doesn't create an Enrollment; that's still a registrar action in
// the enrollments module once the applicant is ready.
const ALLOWED_TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
  SUBMITTED: [AdmissionStatus.UNDER_REVIEW, AdmissionStatus.APPROVED, AdmissionStatus.REJECTED],
  UNDER_REVIEW: [AdmissionStatus.APPROVED, AdmissionStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leads: LeadsService,
  ) {}

  findAllForOrganization(user: AuthenticatedUser, status?: AdmissionStatus) {
    return this.prisma.admission.findMany({
      where: {
        organizationId: user.organizationId,
        ...branchScopeWhere(user, 'admissions.view'),
        ...(status ? { status } : {}),
      },
      include: { lead: true, program: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, organizationId: user.organizationId, ...branchScopeWhere(user, 'admissions.view') },
      include: { lead: true, program: { select: { id: true, name: true } } },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    return admission;
  }

  async create(organizationId: string, actorId: string, dto: CreateAdmissionDto) {
    const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.status !== LeadStatus.APPLICATION) {
      throw new BadRequestException('Only leads at the Application stage can start an admission review');
    }

    const admission = await this.prisma.admission.create({
      data: {
        organizationId,
        branchId: lead.branchId,
        leadId: dto.leadId,
        programId: dto.programId,
        notes: dto.notes,
      },
      include: { lead: true, program: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'admission.created',
      resource: 'admission',
      resourceId: admission.id,
      afterState: admission,
    });

    return admission;
  }

  // Scoped by `admissions.review` (the permission actually gating this
  // transition) rather than reusing `findOne`'s `admissions.view` scope —
  // a custom role could hold `admissions.view` at ORGANIZATION but
  // `admissions.review` at BRANCH, and the narrower one must govern which
  // admissions this action can reach (same fix already applied in
  // RefundsService.transition).
  private async transition(
    user: AuthenticatedUser,
    id: string,
    nextStatus: AdmissionStatus,
    dto: ReviewAdmissionDto,
  ) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, organizationId: user.organizationId, ...branchScopeWhere(user, 'admissions.review') },
      include: { lead: true, program: { select: { id: true, name: true } } },
    });
    if (!admission) throw new NotFoundException('Admission not found');

    const allowed = ALLOWED_TRANSITIONS[admission.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move admission from ${admission.status} to ${nextStatus}`);
    }

    const updated = await this.prisma.admission.update({
      where: { id },
      data: {
        status: nextStatus,
        notes: dto.notes ?? admission.notes,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: { lead: true, program: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `admission.${nextStatus.toLowerCase()}`,
      resource: 'admission',
      resourceId: id,
      beforeState: { status: admission.status },
      afterState: { status: updated.status },
    });

    if (nextStatus === AdmissionStatus.APPROVED) {
      await this.leads.setStatus(user.organizationId, user.id, admission.leadId, LeadStatus.APPLICANT);
    } else if (nextStatus === AdmissionStatus.REJECTED) {
      await this.leads.setStatus(user.organizationId, user.id, admission.leadId, LeadStatus.LOST);
    }

    return updated;
  }

  startReview(user: AuthenticatedUser, id: string, dto: ReviewAdmissionDto) {
    return this.transition(user, id, AdmissionStatus.UNDER_REVIEW, dto);
  }

  approve(user: AuthenticatedUser, id: string, dto: ReviewAdmissionDto) {
    return this.transition(user, id, AdmissionStatus.APPROVED, dto);
  }

  reject(user: AuthenticatedUser, id: string, dto: ReviewAdmissionDto) {
    return this.transition(user, id, AdmissionStatus.REJECTED, dto);
  }
}
