import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { getScope, studentScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';

const PROFILE_SELECT = {
  id: true,
  dateOfBirth: true,
  address: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  educationBackground: true,
  branchId: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
    },
  },
} as const;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ASSIGNED scope (blueprint Section 7's own example: an instructor sees
  // students.view only for their assigned classes) needs a DB lookup — the
  // caller's InstructorProfile id, then the students enrolled in batches
  // that have a class taught by that instructor — so it can't be resolved
  // by the sync `studentScopeWhere` helper the way BRANCH/SELF can.
  private async assignedStudentWhere(user: AuthenticatedUser) {
    const instructor = await this.prisma.instructorProfile.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
    });
    // No instructor profile = assigned to nothing; match no student rather
    // than accidentally falling through to "see everything".
    const instructorProfileId = instructor?.id ?? '__no_instructor_profile__';
    return {
      enrollments: { some: { batch: { classes: { some: { instructorProfileId } } } } },
    };
  }

  private async resolveScopeWhere(user: AuthenticatedUser, permissionKey: string) {
    if (getScope(user, permissionKey) === 'ASSIGNED') {
      return this.assignedStudentWhere(user);
    }
    return studentScopeWhere(user, permissionKey);
  }

  // Scoped by the caller's resolved `students.view` grant (blueprint
  // Section 7): a Branch Manager only sees their branch's students, a
  // student account (SELF scope) only ever sees its own profile, an
  // Instructor (ASSIGNED scope) only sees students in their own classes.
  async findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.studentProfile.findMany({
      where: { organizationId: user.organizationId, ...(await this.resolveScopeWhere(user, 'students.view')) },
      select: PROFILE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id, organizationId: user.organizationId, ...(await this.resolveScopeWhere(user, 'students.view')) },
      select: { ...PROFILE_SELECT, enrollments: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  // roleIds/branchId are opaque ids from client input — without this check
  // an actor could attach a role or branch belonging to a different
  // organization, letting that role's permissions or that branch's
  // branch-scoped data leak into this org (same class of bug fixed in
  // UsersService.create).
  private async assertBelongsToOrganization(organizationId: string, roleIds: string[], branchId?: string) {
    if (roleIds.length > 0) {
      const found = await this.prisma.role.count({ where: { id: { in: roleIds }, organizationId } });
      if (found !== new Set(roleIds).size) {
        throw new BadRequestException('One or more roleIds do not belong to this organization');
      }
    }
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId } });
      if (!branch) throw new BadRequestException('branchId does not belong to this organization');
    }
  }

  async create(organizationId: string, actorId: string, dto: CreateStudentDto) {
    await this.assertBelongsToOrganization(organizationId, dto.roleIds ?? [], dto.branchId);

    const passwordHash = await argon2.hash(dto.password);

    // The `student` system role is always attached, regardless of `roleIds`:
    // this endpoint both creates the User and its StudentProfile in one call,
    // so unlike instructor/staff creation (which attach a profile to a user
    // already provisioned with roles via /v1/users) there's no other step
    // where roles get assigned. Without this, an omitted `roleIds` silently
    // produces an ACTIVE account with zero permissions — unable to view even
    // its own profile.
    const studentRole = await this.prisma.role.findUniqueOrThrow({
      where: { organizationId_key: { organizationId, key: 'student' } },
    });
    const roleIds = new Set([studentRole.id, ...(dto.roleIds ?? [])]);

    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          branches: dto.branchId ? { create: [{ branchId: dto.branchId }] } : undefined,
          roles: { create: Array.from(roleIds).map((roleId) => ({ roleId })) },
        },
      });

      return tx.studentProfile.create({
        data: {
          userId: user.id,
          organizationId,
          branchId: dto.branchId,
          address: dto.address,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
        },
        select: PROFILE_SELECT,
      });
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'student.created',
      resource: 'student_profile',
      resourceId: student.id,
      afterState: student,
    });

    return student;
  }
}
