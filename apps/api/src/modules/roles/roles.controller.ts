import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RolesService } from './roles.service.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Controller('v1/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('roles.manage')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.findAllForOrganization(user.organizationId);
  }

  // The permission catalog a role can be built from. Lives here as well as
  // under /v1/permissions (which needs permissions.manage) so holding
  // roles.manage alone is enough to create and edit roles.
  @Get('permission-catalog')
  @RequirePermissions('roles.manage')
  permissionCatalog() {
    return this.permissions.findAll();
  }

  @Post()
  @RequirePermissions('roles.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('roles.manage')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roles.remove(user, id);
  }
}
