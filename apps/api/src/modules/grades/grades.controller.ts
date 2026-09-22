import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { GradesService } from './grades.service.js';

@Controller('v1/grades')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GradesController {
  constructor(private readonly grades: GradesService) {}

  @Get('me')
  @RequirePermissions('exams.view')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.grades.forCurrentStudent(user.organizationId, user.id);
  }

  @Get('exams/:examId')
  @RequirePermissions('exams.grade')
  findForExam(@CurrentUser() user: AuthenticatedUser, @Param('examId') examId: string) {
    return this.grades.forExam(user.organizationId, examId);
  }
}
