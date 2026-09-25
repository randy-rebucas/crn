import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { branchScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { UpdateStaffDto } from './dto/update-staff.dto.js';

const PROFILE_SELECT = {
  id: true,
  position: true,
  department: true,
  hireDate: true,
  status: true,
  branchId: true,
  createdAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
} as const;

// Non-teaching personnel — deliberately separate from InstructorProfile
// (which classes/schedules attach to). Same BRANCH-scoping shape as
// InstructorsService/StudentsService.
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.staffProfile.findMany({
      where: { organizationId: user.organizationId, ...branchScopeWhere(user, 'staff.view') },
      select: PROFILE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id, organizationId: user.organizationId, ...branchScopeWhere(user, 'staff.view') },
      select: PROFILE_SELECT,
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  // branchId is an opaque id from client input — without this check a
  // caller could plant a StaffProfile pointing at another organization's
  // branch (same bug class fixed elsewhere: users/students/instructors).
  private async assertBranchBelongsToOrganization(organizationId: string, branchId?: string | null) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId } });
    if (!branch) throw new NotFoundException('Branch not found in this organization');
  }

  async create(organizationId: string, actorId: string, dto: CreateStaffDto) {
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, organizationId } });
    if (!user) throw new NotFoundException('User not found in this organization');
    await this.assertBranchBelongsToOrganization(organizationId, dto.branchId);

    const staff = await this.prisma.staffProfile.create({
      data: {
        userId: dto.userId,
        organizationId,
        branchId: dto.branchId,
        position: dto.position,
        department: dto.department,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
      select: PROFILE_SELECT,
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'staff.created',
      resource: 'staff_profile',
      resourceId: staff.id,
      afterState: staff,
    });

    return staff;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateStaffDto) {
    const existing = await this.findOne(user, id);
    await this.assertBranchBelongsToOrganization(user.organizationId, dto.branchId);

    const staff = await this.prisma.staffProfile.update({
      where: { id: existing.id },
      data: dto,
      select: PROFILE_SELECT,
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'staff.updated',
      resource: 'staff_profile',
      resourceId: staff.id,
      beforeState: existing,
      afterState: staff,
    });

    return staff;
  }
}
