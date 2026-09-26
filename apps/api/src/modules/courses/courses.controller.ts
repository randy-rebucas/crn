import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';

@Controller('v1/courses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @RequirePermissions('courses.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('programId') programId?: string) {
    return this.courses.findAllForProgram(user, programId);
  }

  @Post()
  @RequirePermissions('courses.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(user.organizationId, user.id, dto);
  }
}
