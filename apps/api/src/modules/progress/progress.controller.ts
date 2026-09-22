import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ProgressService } from './progress.service.js';

@Controller('v1/progress')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('progress.view')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  // Must be registered before `:studentId` below, or Nest would try to
  // treat "me" as a student id.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.progress.forCurrentStudent(user);
  }

  @Get(':studentId')
  findForStudent(@CurrentUser() user: AuthenticatedUser, @Param('studentId') studentId: string) {
    return this.progress.forStudent(user, studentId);
  }
}
