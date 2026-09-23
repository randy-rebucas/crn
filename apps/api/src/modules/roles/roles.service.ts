import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SCOPE_RANK } from '../auth/permission.utils.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
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

// An actor may only grant a permission at a scope they hold themselves for
// that same permission key — otherwise `roles.manage` alone would let anyone
// mint a role with permissions/scopes broader than their own (e.g. a
// mid-level admin fabricating a role with global `organizations.manage`),
// then use `users.manage` to hand it to an account they control. This is not
// itself the segregation-of-duties check above; it's the baseline "you can't
// grant what you don't have" rule.
function assertActorCanGrant(
  actor: AuthenticatedUser,
  requested: { permissionKey: string; scope: string }[],
) {
  const heldByKey = new Map(actor.permissions.map((p) => [p.key, p.scope]));
  for (const grant of requested) {
    const heldScope = heldByKey.get(grant.permissionKey);
    const heldRank = heldScope ? SCOPE_RANK.indexOf(heldScope) : -1;
    const requestedRank = SCOPE_RANK.indexOf(grant.scope);
    if (heldRank < requestedRank) {
      throw new ForbiddenException(
        `Cannot grant "${grant.permissionKey}" at scope "${grant.scope}": you do not hold it at that scope or broader`,
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

  async create(actor: AuthenticatedUser, dto: CreateRoleDto) {
    const organizationId = actor.organizationId;
    const actorId = actor.id;

    assertNoSodConflict(
      dto.key,
      dto.permissions.map((p) => p.permissionKey),
    );
    assertActorCanGrant(actor, dto.permissions);

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
