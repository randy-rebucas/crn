import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadsService } from '../leads/leads.service.js';
import type { CreatePublicLeadDto } from './dto/create-public-lead.dto.js';
import type { RegisterStudentDto } from './dto/register-student.dto.js';
import { readOrgSettings } from '../settings/org-settings.js';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly audit: AuditService,
  ) {}

  // The public marketing site has no tenant of its own to authenticate
  // against — it resolves to whichever single organization this deployment
  // serves. Multi-tenant public intake (one storefront per organization)
  // would need a slug/domain lookup here instead; not needed yet since the
  // seed data only ever creates one organization.
  private async resolveOrganizationId(): Promise<string> {
    const organization = await this.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!organization) throw new NotFoundException('No organization configured');
    return organization.id;
  }

  // Published-only, same rule content-visibility.ts applies to authenticated
  // callers without a manage permission — an anonymous visitor is exactly
  // that caller, permanently.
  // Contact block and enrollment status for the marketing site. An explicit
  // allow-list: settings also hold internal values (numbering prefixes,
  // notification switches) that anonymous visitors have no business seeing.
  async findPublicSettings() {
    const organizationId = await this.resolveOrganizationId();
    const [settings, organization] = await Promise.all([
      readOrgSettings(this.prisma, organizationId),
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } }),
    ]);
    return {
      organizationName: organization.name,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      additionalPhones: settings.additionalPhones,
      address: settings.address,
      facebookPageName: settings.facebookPageName,
      facebookUrl: settings.facebookUrl,
      enrollmentOpen: settings.enrollmentOpen,
      enrollmentNotice: settings.enrollmentNotice,
      allowSelfEnrollment: settings.allowSelfEnrollment && settings.enrollmentOpen,
    };
  }

  async findPublishedPrograms() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.program.findMany({
      where: { organizationId, status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        courses: {
          where: { status: 'PUBLISHED' },
          select: { id: true, name: true, code: true, description: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveBranches() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.branch.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, code: true, address: true },
      orderBy: { name: 'asc' },
    });
  }

  async findPublishedProgramBySlug(slug: string) {
    const organizationId = await this.resolveOrganizationId();
    const program = await this.prisma.program.findFirst({
      where: { organizationId, slug, status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        courses: {
          where: { status: 'PUBLISHED' },
          select: { id: true, name: true, code: true, description: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  // Every instructor at the organization, not gated by a publish workflow —
  // instructor profiles have no ContentStatus (see the audit finding that
  // flagged this): unlike Program/Course, there's no draft/review concept
  // for "is this person's bio ready to show publicly" yet, so this exposes
  // every ACTIVE instructor's profile. Revisit if that granularity is ever
  // needed (e.g. an isPublic flag on InstructorProfile).
  async findInstructors() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.instructorProfile.findMany({
      where: { organizationId, user: { status: 'ACTIVE' } },
      select: {
        id: true,
        bio: true,
        specialization: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findInstructor(id: string) {
    const organizationId = await this.resolveOrganizationId();
    const instructor = await this.prisma.instructorProfile.findFirst({
      where: { id, organizationId, user: { status: 'ACTIVE' } },
      select: {
        id: true,
        bio: true,
        specialization: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');
    return instructor;
  }

  // Upcoming/active batches double as the public "Schedule" screen — a
  // batch is the unit prospective students actually enroll into (it has
  // start/end dates and a branch), unlike Class, which is an internal
  // section-and-room assignment.
  async findUpcomingSchedule() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.batch.findMany({
      where: {
        branch: { organizationId },
        status: { in: ['UPCOMING', 'ACTIVE'] },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        program: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findAnnouncements() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.announcement.findMany({
      where: { organizationId, status: 'PUBLISHED' },
      select: { id: true, title: true, body: true, publishedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAnnouncement(id: string) {
    const organizationId = await this.resolveOrganizationId();
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, organizationId, status: 'PUBLISHED' },
      select: { id: true, title: true, body: true, publishedAt: true, createdAt: true },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async findSuccessStories() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.successStory.findMany({
      where: { organizationId, status: 'PUBLISHED' },
      select: { id: true, graduateName: true, programName: true, year: true, testimonial: true, photoUrl: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findFaqItems() {
    const organizationId = await this.resolveOrganizationId();
    return this.prisma.faqItem.findMany({
      where: { organizationId, status: 'PUBLISHED' },
      select: { id: true, question: true, answer: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createLead(dto: CreatePublicLeadDto) {
    const organizationId = await this.resolveOrganizationId();
    // actorId omitted: no authenticated user exists for an anonymous
    // website submission, and AuditLog.actorId is nullable for exactly
    // this case.
    const lead = await this.leads.create(organizationId, undefined, {
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      programInterest: dto.programInterest,
      message: dto.message,
      source: 'Website',
    });
    // Only ever return an ack, never the full row — organizationId,
    // assignedToId, and status are internal and not this caller's business.
    return { id: lead.id, received: true };
  }

  // Self-service account creation ("Registration", blueprint Section 15/24)
  // — deliberately gated by OrganizationSettings.allowSelfEnrollment, which
  // the admin Settings screen already exposes: an org that wants every
  // student account created by a registrar (the existing
  // POST /v1/students flow) can turn this off without a code change.
  async registerStudent(dto: RegisterStudentDto) {
    const organizationId = await this.resolveOrganizationId();

    const settings = await readOrgSettings(this.prisma, organizationId);
    if (!settings.enrollmentOpen) {
      throw new BadRequestException('Enrollment is currently closed. Please contact us about the next intake.');
    }
    if (!settings.allowSelfEnrollment) {
      throw new BadRequestException('Self-registration is not open. Please contact us to enroll.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this email already exists.');

    const studentRole = await this.prisma.role.findUniqueOrThrow({
      where: { organizationId_key: { organizationId, key: 'student' } },
    });

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          roles: { create: [{ roleId: studentRole.id }] },
        },
      });
      await tx.studentProfile.create({ data: { userId: created.id, organizationId } });
      return created;
    });

    await this.audit.log({
      organizationId,
      actorId: user.id,
      action: 'auth.self_registered',
      resource: 'user',
      resourceId: user.id,
    });

    return { id: user.id, email: user.email };
  }
}
