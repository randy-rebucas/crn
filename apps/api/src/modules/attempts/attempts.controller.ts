import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AttemptsService } from './attempts.service.js';
import { StartAttemptDto } from './dto/start-attempt.dto.js';
import { SubmitAttemptDto } from './dto/submit-attempt.dto.js';
import { GradeAnswerDto } from './dto/grade-answer.dto.js';

@Controller('v1/attempts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get()
  @RequirePermissions('exams.grade')
  findAllForExam(@CurrentUser() user: AuthenticatedUser, @Query('examId') examId: string) {
    return this.attempts.findAllForExam(user, examId);
  }

  // Must be registered before `:id` below, or Nest would try to treat
  // "me" as an attempt id.
  @Get('me')
  @RequirePermissions('exams.view')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.attempts.findAllForCurrentStudent(user.organizationId, user.id);
  }

  @Get(':id')
  @RequirePermissions('exams.view')
  findResult(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.attempts.findResultForStudent(user.organizationId, user.id, id);
  }

  @Post()
  @RequirePermissions('exams.view')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartAttemptDto) {
    return this.attempts.start(user.organizationId, user.id, dto.examId);
  }

  @Post(':id/submit')
  @RequirePermissions('exams.view')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.attempts.submit(user.organizationId, user.id, id, dto);
  }

  @Patch(':id/answers/:questionId/grade')
  @RequirePermissions('exams.grade')
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: GradeAnswerDto,
  ) {
    return this.attempts.gradeAnswer(user, id, questionId, dto.pointsAwarded);
  }
}
