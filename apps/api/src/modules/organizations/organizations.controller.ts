import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { OrganizationsService } from './organizations.service.js';

// No platform-admin role exists in this system — organization creation is
// an out-of-band provisioning step (see prisma/seed.ts), not something a
// tenant user reaches through this API. Every route here is scoped to the
// caller's own organizationId; see organizations.service.ts.
@Controller('v1/organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions('organizations.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('organizations.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizations.findOne(user.organizationId, id);
  }
}
