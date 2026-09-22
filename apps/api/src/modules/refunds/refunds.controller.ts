import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RefundsService } from './refunds.service.js';
import { CreateRefundDto } from './dto/create-refund.dto.js';

@Controller('v1/refunds')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  @RequirePermissions('refunds.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.refunds.findAllForOrganization(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('refunds.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.refunds.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('refunds.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRefundDto) {
    return this.refunds.create(user.organizationId, user.id, dto);
  }

  @Patch(':id/officer-approve')
  @RequirePermissions('refunds.officer_approve')
  officerApprove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.refunds.officerApprove(user.organizationId, user.id, id);
  }

  @Patch(':id/manager-approve')
  @RequirePermissions('refunds.manager_approve')
  managerApprove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.refunds.managerApprove(user.organizationId, user.id, id);
  }

  // Reject can happen at either step of the chain, so it needs whichever
  // permission matches the refund's *current* stage, not a single fixed
  // one — that check happens inside the service, which already loads the
  // refund to see its status.
  // `refunds.view` is only the floor the guard can check statically; the
  // service itself requires `refunds.officer_approve` or
  // `refunds.manager_approve` depending on the refund's current stage —
  // never leave a mutating endpoint with no @RequirePermissions at all,
  // since the guard treats "no permissions listed" as "no check needed".
  @Patch(':id/reject')
  @RequirePermissions('refunds.view')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.refunds.reject(user, id);
  }

  @Patch(':id/process')
  @RequirePermissions('refunds.process')
  process(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.refunds.process(user.organizationId, user.id, id);
  }
}
