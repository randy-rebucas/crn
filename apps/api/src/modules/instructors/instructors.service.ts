import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { branchScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateInstructorDto } from './dto/create-instructor.dto.js';
import type { UpdateInstructorDto } from './dto/update-instructor.dto.js';

const PROFILE_SELECT = {
  id: true,
  bio: true,
  specialization: true,
  isPublic: true,
  branchId: true,
  createdAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class InstructorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.instructorProfile.findMany({
      where: { organizationId: user.organizationId, ...branchScopeWhere(user, 'instructors.view') },
      select: PROFILE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateInstructorDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, organizationId },
    });
    if (!user) throw new NotFoundException('User not found in this organization');

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, organizationId } });
      if (!branch) throw new BadRequestException('branchId does not belong to this organization');
    }

    const profile = await this.prisma.instructorProfile.create({
      data: {
        userId: dto.userId,
        organizationId,
        branchId: dto.branchId,
        bio: dto.bio,
        specialization: dto.specialization,
        isPublic: dto.isPublic,
      },
      select: PROFILE_SELECT,
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'instructor.created',
      resource: 'instructor_profile',
      resourceId: profile.id,
      afterState: profile,
    });

    return profile;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateInstructorDto) {
    const existing = await this.prisma.instructorProfile.findFirst({
      where: { id, organizationId: user.organizationId, ...branchScopeWhere(user, 'instructors.update') },
      select: PROFILE_SELECT,
    });
    if (!existing) throw new NotFoundException('Instructor not found');

    const profile = await this.prisma.instructorProfile.update({
      where: { id },
      data: { bio: dto.bio, specialization: dto.specialization, isPublic: dto.isPublic },
      select: PROFILE_SELECT,
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'instructor.updated',
      resource: 'instructor_profile',
      resourceId: profile.id,
      beforeState: existing,
      afterState: profile,
    });

    return profile;
  }
}
