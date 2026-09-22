import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { QuestionsService } from './questions.service.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { ReviewQuestionDto } from './dto/review-question.dto.js';

@Controller('v1/questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  @RequirePermissions('exams.view')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('subjectId') subjectId: string,
    @Query('status') status?: ContentStatus,
  ) {
    return this.questions.findAllForSubject(user, subjectId, status);
  }

  @Post()
  @RequirePermissions('exams.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuestionDto) {
    return this.questions.create(user.organizationId, user.id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('exams.approve')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewQuestionDto,
  ) {
    return this.questions.review(user.organizationId, user.id, id, dto.status);
  }
}
