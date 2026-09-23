import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { branchScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateInstructorDto } from './dto/create-instructor.dto.js';

const PROFILE_SELECT = {
  id: true,
  bio: true,
  specialization: true,
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
}
