import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdmissionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AdmissionsService } from './admissions.service.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';
import { ReviewAdmissionDto } from './dto/review-admission.dto.js';

@Controller('v1/admissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get()
  @RequirePermissions('admissions.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: AdmissionStatus) {
    return this.admissions.findAllForOrganization(user, status);
  }

  @Get(':id')
  @RequirePermissions('admissions.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admissions.findOne(user, id);
  }

  @Post()
  @RequirePermissions('admissions.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdmissionDto) {
    return this.admissions.create(user.organizationId, user.id, dto);
  }

  @Patch(':id/start-review')
  @RequirePermissions('admissions.review')
  startReview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewAdmissionDto) {
    return this.admissions.startReview(user, id, dto);
  }

  @Patch(':id/approve')
  @RequirePermissions('admissions.review')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewAdmissionDto) {
    return this.admissions.approve(user, id, dto);
  }

  @Patch(':id/reject')
  @RequirePermissions('admissions.review')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewAdmissionDto) {
    return this.admissions.reject(user, id, dto);
  }
}
