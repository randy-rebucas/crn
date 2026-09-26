import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { MaterialType } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurriculumService, MATERIAL_TYPES } from './curriculum.service.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { SetContentStatusDto } from './dto/set-content-status.dto.js';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModulesController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('v1/modules')
  @RequirePermissions('courses.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('subjectId') subjectId: string) {
    return this.curriculum.findModulesForSubject(user, subjectId);
  }

  @Get('v1/modules/outline')
  @RequirePermissions('courses.view')
  outline(@CurrentUser() user: AuthenticatedUser, @Query('subjectId') subjectId: string) {
    if (!subjectId) throw new BadRequestException('subjectId is required');
    return this.curriculum.findOutlineForSubject(user, subjectId);
  }

  @Post('v1/modules')
  @RequirePermissions('courses.update')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateModuleDto) {
    return this.curriculum.createModule(user.organizationId, user.id, dto);
  }

  @Patch('v1/modules/:id/status')
  @RequirePermissions('courses.update')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetContentStatusDto,
  ) {
    return this.curriculum.setStatus('module', user.organizationId, user.id, id, dto.status);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LessonsController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('v1/lessons')
  @RequirePermissions('courses.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('moduleId') moduleId: string) {
    return this.curriculum.findLessonsForModule(user, moduleId);
  }

  @Post('v1/lessons')
  @RequirePermissions('courses.update')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLessonDto) {
    return this.curriculum.createLesson(user.organizationId, user.id, dto);
  }

  @Patch('v1/lessons/:id/status')
  @RequirePermissions('courses.update')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetContentStatusDto,
  ) {
    return this.curriculum.setStatus('lesson', user.organizationId, user.id, id, dto.status);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaterialsController {
  constructor(private readonly curriculum: CurriculumService) {}

  // The caller's own study library. `?type=VIDEO` or `?type=PDF,DOCUMENT`
  // narrows by material type; omit it for everything.
  @Get('v1/materials/mine')
  @RequirePermissions('courses.view')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query('type') type?: string) {
    const requested = (type ?? '')
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const invalid = requested.filter((t) => !MATERIAL_TYPES.includes(t as MaterialType));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown material type: ${invalid.join(', ')}`);
    }
    return this.curriculum.findMyMaterials(user, requested as MaterialType[]);
  }

  @Get('v1/materials')
  @RequirePermissions('courses.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('lessonId') lessonId: string) {
    return this.curriculum.findMaterialsForLesson(user, lessonId);
  }

  @Post('v1/materials')
  @RequirePermissions('courses.update')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMaterialDto) {
    return this.curriculum.createMaterial(user.organizationId, user.id, dto);
  }

  @Patch('v1/materials/:id/status')
  @RequirePermissions('courses.update')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetContentStatusDto,
  ) {
    return this.curriculum.setStatus('material', user.organizationId, user.id, id, dto.status);
  }
}
