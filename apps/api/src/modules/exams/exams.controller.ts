import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ExamsService } from './exams.service.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { AddExamQuestionDto } from './dto/add-exam-question.dto.js';

@Controller('v1/exams')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @RequirePermissions('exams.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.findAllForOrganization(user);
  }

  @Get(':id')
  @RequirePermissions('exams.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exams.findOne(user.organizationId, id, user);
  }

  @Post()
  @RequirePermissions('exams.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExamDto) {
    return this.exams.create(user.organizationId, user.id, dto);
  }

  @Post(':id/questions')
  @RequirePermissions('exams.update')
  addQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddExamQuestionDto,
  ) {
    return this.exams.addQuestion(user.organizationId, user.id, id, dto);
  }

  @Delete(':id/questions/:examQuestionId')
  @RequirePermissions('exams.update')
  removeQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('examQuestionId') examQuestionId: string,
  ) {
    return this.exams.removeQuestion(user.organizationId, user.id, id, examQuestionId);
  }

  @Patch(':id/publish')
  @RequirePermissions('exams.publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exams.publish(user.organizationId, user.id, id);
  }
}
