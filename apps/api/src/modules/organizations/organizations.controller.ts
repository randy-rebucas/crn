import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('v1/organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions('organizations.view')
  findAll() {
    return this.organizations.findAll();
  }

  @Get(':id')
  @RequirePermissions('organizations.view')
  findOne(@Param('id') id: string) {
    return this.organizations.findOne(id);
  }

  @Post()
  @RequirePermissions('organizations.create')
  create(@Body() body: { name: string; slug: string }) {
    return this.organizations.create(body);
  }
}
