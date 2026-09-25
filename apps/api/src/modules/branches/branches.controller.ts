import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { BranchesService } from './branches.service.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';

@Controller('v1/branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions('branches.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.branches.findAllForOrganization(user.organizationId);
  }

  @Post()
  @RequirePermissions('branches.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name: string; code: string; address?: string },
  ) {
    return this.branches.create(user.organizationId, body);
  }

  // No separate branches.update permission exists in the catalog; editing a
  // location is gated by the same permission that creates one.
  @Patch(':id')
  @RequirePermissions('branches.create')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branches.update(user.organizationId, user.id, id, dto);
  }
}
