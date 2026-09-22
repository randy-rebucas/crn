import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ProgramsService } from './programs.service.js';
import { CreateProgramDto } from './dto/create-program.dto.js';

@Controller('v1/programs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @RequirePermissions('programs.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.programs.findAllForOrganization(user);
  }

  @Get(':id')
  @RequirePermissions('programs.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.programs.findOne(user.organizationId, id, user);
  }

  @Post()
  @RequirePermissions('programs.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProgramDto) {
    return this.programs.create(user.organizationId, user.id, dto);
  }

  @Patch(':id/publish')
  @RequirePermissions('programs.publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.programs.setStatus(user.organizationId, user.id, id, ContentStatus.PUBLISHED);
  }

  @Patch(':id/archive')
  @RequirePermissions('programs.archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.programs.setStatus(user.organizationId, user.id, id, ContentStatus.ARCHIVED);
  }
}
