import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';

// Segregation of duties: these permission pairs each gate two distinct
// steps of the same approval chain and must never land on one role, or a
// single person could approve their own request end to end. Mirrors the
// check applied to the seeded system roles in prisma/seed.ts.
const SOD_CONFLICTS: [string, string][] = [['refunds.officer_approve', 'refunds.manager_approve']];

function assertNoSodConflict(roleKey: string, permissionKeys: string[]) {
  const held = new Set(permissionKeys);
  for (const [a, b] of SOD_CONFLICTS) {
    if (held.has(a) && held.has(b)) {
      throw new BadRequestException(
        `Segregation-of-duties violation: role "${roleKey}" cannot hold both "${a}" and "${b}"`,
      );
    }
  }
}

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
    assertNoSodConflict(
      dto.key,
      dto.permissions.map((p) => p.permissionKey),
    );

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
