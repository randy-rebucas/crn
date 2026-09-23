import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';

const SAFE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.user.findMany({ where: { organizationId }, select: SAFE_SELECT });
  }

  // roleIds/branchIds are opaque ids from client input — without this check
  // an actor could attach a role or branch belonging to a different
  // organization (its permissions/scope would then leak into this org via
  // that role's grants, or its branch-scoped data via UserBranch).
  private async assertBelongsToOrganization(organizationId: string, roleIds: string[], branchIds: string[]) {
    if (roleIds.length > 0) {
      const found = await this.prisma.role.count({ where: { id: { in: roleIds }, organizationId } });
      if (found !== new Set(roleIds).size) {
        throw new BadRequestException('One or more roleIds do not belong to this organization');
      }
    }
    if (branchIds.length > 0) {
      const found = await this.prisma.branch.count({ where: { id: { in: branchIds }, organizationId } });
      if (found !== new Set(branchIds).size) {
        throw new BadRequestException('One or more branchIds do not belong to this organization');
      }
    }
  }

  async create(organizationId: string, actorId: string, dto: CreateUserDto) {
    await this.assertBelongsToOrganization(organizationId, dto.roleIds ?? [], dto.branchIds ?? []);

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
        branches: dto.branchIds
          ? { create: dto.branchIds.map((branchId) => ({ branchId })) }
          : undefined,
      },
      select: SAFE_SELECT,
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'user.created',
      resource: 'user',
      resourceId: user.id,
      afterState: user,
    });

    return user;
  }
}
