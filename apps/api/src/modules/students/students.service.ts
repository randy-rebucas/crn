import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { studentScopeWhere } from '../../common/authz/scope.js';
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

  // Scoped by the caller's resolved `students.view` grant (blueprint
  // Section 7): a Branch Manager only sees their branch's students, a
  // student account (SELF scope) only ever sees its own profile.
  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.studentProfile.findMany({
      where: { organizationId: user.organizationId, ...studentScopeWhere(user, 'students.view') },
      select: PROFILE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id, organizationId: user.organizationId, ...studentScopeWhere(user, 'students.view') },
      select: { ...PROFILE_SELECT, enrollments: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async create(organizationId: string, actorId: string, dto: CreateStudentDto) {
    const passwordHash = await argon2.hash(dto.password);

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
          roles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
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
