import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PricingService } from './pricing.service.js';
import { CreatePricingDto } from './dto/create-pricing.dto.js';

@Controller('v1/pricing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  @RequirePermissions('pricing.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('programId') programId: string) {
    return this.pricing.findAllForProgram(user.organizationId, programId);
  }

  @Post()
  @RequirePermissions('pricing.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePricingDto) {
    return this.pricing.create(user.organizationId, user.id, dto);
  }
}
