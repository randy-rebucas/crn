import { Injectable } from '@nestjs/common';
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

  async create(organizationId: string, actorId: string, dto: CreateUserDto) {
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
