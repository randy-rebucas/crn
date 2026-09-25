import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('v1/audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  // Every actor and resource that appears in this organization's log, for
  // the filter dropdowns — the main list is capped at 200 rows, so deriving
  // the choices from it would hide anyone outside that window.
  @Get('facets')
  @RequirePermissions('audit_logs.view')
  async facets(@CurrentUser() user: AuthenticatedUser) {
    const [resources, actorIds] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId },
        distinct: ['resource'],
        select: { resource: true },
        orderBy: { resource: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId, actorId: { not: null } },
        distinct: ['actorId'],
        select: { actorId: true },
      }),
    ]);
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds.map((a) => a.actorId as string) } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return { resources: resources.map((r) => r.resource), actors };
  }

  @Get()
  @RequirePermissions('audit_logs.view')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        resource,
        resourceId,
        actorId,
        ...(from || to
          ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
