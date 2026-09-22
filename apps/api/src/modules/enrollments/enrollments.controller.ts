import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { TransitionEnrollmentDto } from './dto/transition-enrollment.dto.js';

@Controller('v1/enrollments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get()
  @RequirePermissions('enrollments.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollments.findAllForOrganization(user);
  }

  @Get(':id')
  @RequirePermissions('enrollments.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.enrollments.findOne(user, id);
  }

  @Post()
  @RequirePermissions('enrollments.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEnrollmentDto) {
    return this.enrollments.create(user.organizationId, user.id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('enrollments.update')
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionEnrollmentDto,
  ) {
    return this.enrollments.transition(user, id, dto.status);
  }
}
