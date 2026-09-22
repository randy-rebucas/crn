import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AttendanceService } from './attendance.service.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@Controller('v1/attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @RequirePermissions('attendance.view')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    if (studentId) return this.attendance.findAllForStudent(user, studentId);
    return this.attendance.findAllForClass(user, classId!);
  }

  @Post()
  @RequirePermissions('attendance.create')
  mark(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(user, dto);
  }
}
