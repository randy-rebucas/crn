import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ReportsService } from './reports.service.js';

@Controller('v1/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('reports.view')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('enrollment-funnel')
  enrollmentFunnel(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.enrollmentFunnel(user.organizationId);
  }

  @Get('revenue')
  revenue(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.revenueSummary(user.organizationId);
  }

  @Get('attendance')
  attendance(@CurrentUser() user: AuthenticatedUser, @Query('classId') classId?: string) {
    return this.reports.attendanceSummary(user.organizationId, classId);
  }

  @Get('exam-performance')
  examPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.examPerformance(user.organizationId);
  }

  @Get('attempts-trend')
  attemptsTrend(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.attemptsTrend(user.organizationId);
  }
}
