import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateRoleDto) {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissions.map((p) => p.permissionKey) } },
    });

    const byKey = new Map(permissions.map((p) => [p.key, p]));
    for (const requested of dto.permissions) {
      if (!byKey.has(requested.permissionKey)) {
        throw new NotFoundException(`Unknown permission key: ${requested.permissionKey}`);
      }
    }

    const role = await this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        key: dto.key,
        description: dto.description,
        permissions: {
          create: dto.permissions.map((p) => ({
            scope: p.scope,
            permission: { connect: { id: byKey.get(p.permissionKey)!.id } },
          })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'role.created',
      resource: 'role',
      resourceId: role.id,
      afterState: role,
    });

    return role;
  }
}
