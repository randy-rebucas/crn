import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { InstructorsService } from './instructors.service.js';
import { CreateInstructorDto } from './dto/create-instructor.dto.js';

@Controller('v1/instructors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InstructorsController {
  constructor(private readonly instructors: InstructorsService) {}

  @Get()
  @RequirePermissions('instructors.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.instructors.findAllForOrganization(user.organizationId);
  }

  @Post()
  @RequirePermissions('instructors.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInstructorDto) {
    return this.instructors.create(user.organizationId, user.id, dto);
  }
}
