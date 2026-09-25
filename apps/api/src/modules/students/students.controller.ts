import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { StudentsService } from './students.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateMyStudentDto } from './dto/update-my-student.dto.js';
import { UpdateMyPreferencesDto } from './dto/update-my-preferences.dto.js';

@Controller('v1/students')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions('students.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.students.findAllForOrganization(user);
  }

  // No permission key: any signed-in account with a student profile may edit
  // its own contact details. The service resolves the profile from the
  // caller's userId, never from input.
  @Patch('me')
  updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyStudentDto) {
    return this.students.updateMine(user, dto);
  }

  // Same self-only rule as PATCH me: the profile comes from the caller's
  // userId. Returns effective values (defaults until first save).
  @Get('me/preferences')
  getMyPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.students.getMyPreferences(user);
  }

  @Patch('me/preferences')
  updateMyPreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyPreferencesDto) {
    return this.students.updateMyPreferences(user, dto);
  }

  @Get(':id')
  @RequirePermissions('students.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.students.findOne(user, id);
  }

  @Post()
  @RequirePermissions('students.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user.organizationId, user.id, dto);
  }
}
