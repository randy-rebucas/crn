import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SchedulesService } from './schedules.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';

@Controller('v1/schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  // No permission key: self-scoped in the service (see findMine).
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.schedules.findMine(user.organizationId, user.id);
  }

  @Get()
  @RequirePermissions('schedules.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('classId') classId: string) {
    return this.schedules.findAllForClass(user.organizationId, classId);
  }

  @Post()
  @RequirePermissions('schedules.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateScheduleDto) {
    return this.schedules.create(user.organizationId, user.id, dto);
  }
}
