import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@Controller('v1/payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions('payments.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('invoiceId') invoiceId?: string) {
    return this.payments.findAllForInvoice(user, invoiceId);
  }

  @Post()
  @RequirePermissions('payments.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, user.id, dto);
  }

  @Patch(':id/verify')
  @RequirePermissions('payments.verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.verify(user, user.id, id);
  }

  @Patch(':id/reject')
  @RequirePermissions('payments.verify')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.reject(user, user.id, id);
  }
}
