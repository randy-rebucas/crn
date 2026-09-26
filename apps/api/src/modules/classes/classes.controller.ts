import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClassesService } from './classes.service.js';
import { CreateClassDto } from './dto/create-class.dto.js';

@Controller('v1/classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @RequirePermissions('classes.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.classes.findAll(user);
  }

  @Get(':id')
  @RequirePermissions('classes.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.classes.findOne(user, id);
  }

  // Gated by `attendance.view` (not `classes.view`) since the roster's
  // only real consumer is the attendance-marking flow, and that's the
  // permission an instructor actually holds.
  @Get(':id/roster')
  @RequirePermissions('attendance.view')
  roster(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.classes.roster(user, id);
  }

  @Post()
  @RequirePermissions('classes.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassDto) {
    return this.classes.create(user.organizationId, user.id, dto);
  }
}
